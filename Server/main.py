from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pydantic import BaseModel
import pandas as pd
import xgboost as xgb
from datetime import date
from fastapi import Path
from datetime import datetime, timedelta


# יצירת אפליקציה
app = FastAPI()

# חיבור למונגו
client = MongoClient("mongodb://localhost:27017/")
db = client["emeq_hefer_db"]
requests_collection = db["requests"]

# הפעלת CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictionRequest(BaseModel):
    settlement: str
    temperature: float
    predict_date: str  # YYYY-MM-DD

# --- ראוטים --- #

@app.get("/")
def read_root():
    return {"message": "FastAPI server is running successfully 🚀"}

@app.get("/requests")
def get_all_requests():
    try:
        requests = list(requests_collection.find({}, {"_id": 0}))
        return {"requests": requests}
    except Exception as e:
        return {"error": str(e)}

@app.get("/analytics/topics/{settlement}")
def get_topics_by_settlement(settlement: str = Path(...)):
    try:
        one_year_ago = datetime.now() - timedelta(days=365)

        pipeline = [
            {
                "$match": {
                    "$expr": {
                        "$gte": [
                            { "$toDate": "$openDate" },
                            { "$toDate": one_year_ago.strftime("%Y-%m-%dT%H:%M:%S") }
                        ]
                    },
                    "settlement": settlement
                }
            },
            {
                "$group": {
                    "_id": "$topic",
                    "count": { "$sum": 1 }
                }
            },
            { "$sort": { "count": -1 } },
            { "$limit": 10 }
        ]

        top_topics = list(requests_collection.aggregate(pipeline))
        result = [{"topic": item["_id"], "count": item["count"]} for item in top_topics]

        return {"topics": result}

    except Exception as e:
        return {"error": str(e)}


@app.get("/requests/in-progress/count")
def get_in_progress_requests_count():
    try:
        base_filter = {
            "status": {
                "$nin": ["הטיפול הסתיים", "נסגר בעקבות אי מענה של הפונה"]
            }
        }

        total_in_progress = requests_collection.count_documents(base_filter)

        no_exceed_in_progress = requests_collection.count_documents({
            **base_filter,
            "exceededDeadline": 0,
            "exceededDeadlinePercentage": 0
        })

        exceed_in_progress = total_in_progress - no_exceed_in_progress

        return {
            "in_progress_requests_count": total_in_progress,
            "in_progress_no_exceed_count": no_exceed_in_progress,
            "in_progress_exceed_count": exceed_in_progress
        }
    except Exception as e:
        return {"error": str(e)}
    

    # --- טעינת מודל XGBoost על בסיס דאטה קיים --- #
try:
    requests_data = list(requests_collection.find({}, {"_id": 0}))
    df = pd.DataFrame(requests_data)
except Exception:
    df = None

if df is not None and not df.empty:
    df['openDate_dt'] = pd.to_datetime(df['openDate'], errors='coerce')
    df.dropna(subset=['openDate_dt', 'settlement', 'temperature'], inplace=True)
    df['settlement'] = df['settlement'].astype(str).str.strip()
    df['temperature'] = pd.to_numeric(df['temperature'], errors='coerce')
    df.dropna(subset=['temperature'], inplace=True)

    df['date'] = df['openDate_dt'].dt.date
    df['date'] = pd.to_datetime(df['date'])

    daily_data = df.groupby(['date', 'settlement']).agg(
        Daily_Complaints=('date', 'size'),
        Avg_Daily_Temp=('temperature', 'mean')
    ).reset_index()

    daily_data['Year'] = daily_data['date'].dt.year
    daily_data['Month'] = daily_data['date'].dt.month
    daily_data['Day'] = daily_data['date'].dt.day
    daily_data['DayOfWeek'] = daily_data['date'].dt.dayofweek
    daily_data['DayOfYear'] = daily_data['date'].dt.dayofyear
    daily_data['IsWeekend'] = daily_data['DayOfWeek'].isin([4,5]).astype(int)

    daily_data_encoded = pd.get_dummies(daily_data, columns=['settlement'], prefix='Loc', drop_first=False)

    features_columns = [col for col in daily_data_encoded.columns if col not in ['Daily_Complaints', 'date']]
    X = daily_data_encoded[features_columns]
    y = daily_data_encoded['Daily_Complaints']

    final_model = xgb.XGBRegressor(objective='reg:squarederror', n_estimators=100, random_state=42)
    final_model.fit(X, y)
else:
    final_model = None
    features_columns = []


def predict_single_locality(locality_name: str, temp: float, predict_date: date):
    base_features = {
        'Avg_Daily_Temp': temp,
        'Year': predict_date.year,
        'Month': predict_date.month,
        'Day': predict_date.day,
        'DayOfWeek': predict_date.weekday(),
        'DayOfYear': predict_date.timetuple().tm_yday,
        'IsWeekend': 1 if predict_date.weekday() in [4,5] else 0
    }
    for col in features_columns:
        if col.startswith('Loc_'):
            base_features[col] = 0
    locality_col = f'Loc_{locality_name}'
    if locality_col in features_columns:
        base_features[locality_col] = 1

    input_df = pd.DataFrame([base_features])
    prediction = final_model.predict(input_df)[0]
    return max(0, round(prediction))


@app.post("/predict/all")
def predict_all_localities(temp: float, predict_date: str):
    if final_model is None:
        return {"error": "Model not available."}
    predict_date = pd.to_datetime(predict_date)
    
    results = []
    total = 0
    
    for loc_col in features_columns:
        if loc_col.startswith("Loc_"):
            locality_name = loc_col.replace("Loc_", "")
            pred = predict_single_locality(locality_name, temp, predict_date)
            results.append({
                "settlement": locality_name,
                "predicted_complaints": pred
            })
            total += pred

    return {
        "total_predicted_complaints": total,
        "predictions": results
    }

@app.get("/analytics/topics/{settlement}")
def get_topics_by_settlement(settlement: str = Path(...)):
    try:
        pipeline = [
            { "$match": { "settlement": settlement } },
            { "$group": { "_id": "$topic", "count": { "$sum": 1 } } },
            { "$sort": { "count": -1 } },
            { "$limit": 10 }  # 🆕 נוסיף הגבלת עשר נושאים הכי נפוצים
        ]

        result = list(requests_collection.aggregate(pipeline))
        formatted_result = [{"topic": item["_id"], "count": item["count"]} for item in result if item["_id"]]

        return {"topics": formatted_result}

    except Exception as e:
        return {"error": str(e)}

    

@app.get("/analytics/monthly/{settlement}")
def get_monthly_requests_by_settlement(settlement: str = Path(...)):
    try:
        # מחשבים את התאריך שנה אחורה מהיום
        one_year_ago = datetime.now() - timedelta(days=365)

        pipeline = [
            {
                "$match": {
                    "settlement": settlement,
                    "openDate": { "$gte": one_year_ago.strftime("%Y-%m-%d") }
                }
            },
            {
                "$project": {
                    "month": { "$month": { "$toDate": "$openDate" } }
                }
            },
            {
                "$group": {
                    "_id": "$month",
                    "count": { "$sum": 1 }
                }
            },
            { "$sort": { "_id": 1 } }
        ]

        result = list(requests_collection.aggregate(pipeline))
        formatted_result = [{"month": item["_id"], "count": item["count"]} for item in result]

        return {"monthly_counts": formatted_result}

    except Exception as e:
        return {"error": str(e)}


@app.get("/analytics/avg-duration/{settlement}")
def get_avg_duration_by_topic(settlement: str = Path(...)):
    try:
        one_year_ago = datetime.now() - timedelta(days=365)

        pipeline = [
            {
                "$match": {
                    "$expr": {
                        "$gte": [
                            { "$toDate": "$openDate" },
                            { "$toDate": one_year_ago.strftime("%Y-%m-%dT%H:%M:%S") }
                        ]
                    },
                    "settlement": settlement,
                    "duration": { "$gt": 0 }
                }
            },
            {
                "$group": {
                    "_id": "$topic",
                    "avgDuration": { "$avg": "$duration" }
                }
            },
            { "$sort": { "avgDuration": -1 } },
            { "$limit": 10 }
        ]

        result = list(requests_collection.aggregate(pipeline))
        formatted_result = [{"topic": item["_id"], "avgDuration": round(item["avgDuration"], 2)} for item in result]

        return {"avg_durations": formatted_result}

    except Exception as e:
        return {"error": str(e)}


@app.get("/requests/top-topics")
def get_top_topics_in_exceed():
    try:
        pipeline = [
            {
                "$match": {
                    "status": {
                        "$nin": ["הטיפול הסתיים", "נסגר בעקבות אי מענה של הפונה"]
                    }
                }
            },
            {
                "$group": {
                    "_id": "$topic",
                    "count": { "$sum": 1 }
                }
            },
            {
                "$sort": { "count": -1 }
            },
            {
                "$limit": 3
            }
        ]

        top_topics = list(requests_collection.aggregate(pipeline))

        # מבנה תוצאה יפה לקריאה
        result = [{"topic": item["_id"], "count": item["count"]} for item in top_topics]

        return {"top_topics": result}

    except Exception as e:
        return {"error": str(e)}


# --- טעינת מודל RandomForest חדש לחיזוי אגף --- #
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score

try:
    rf_requests_data = list(requests_collection.find({}, {"_id": 0}))
    rf_df = pd.DataFrame(rf_requests_data)
except Exception:
    rf_df = None

if rf_df is not None and not rf_df.empty:
    rf_df.dropna(subset=['settlement', 'department', 'openDate', 'temperature'], inplace=True)
    rf_df['openDate_dt'] = pd.to_datetime(rf_df['openDate'], errors='coerce')
    rf_df.dropna(subset=['openDate_dt'], inplace=True)

    rf_df['Month'] = rf_df['openDate_dt'].dt.month
    rf_df['DayOfWeek'] = rf_df['openDate_dt'].dt.dayofweek

    # תכונות לחיזוי
    rf_features = rf_df[['settlement', 'Month', 'DayOfWeek', 'temperature']]
    rf_target = rf_df['department']

    # קידוד
    settlement_encoder = LabelEncoder()
    department_encoder = LabelEncoder()

    rf_features['settlement'] = settlement_encoder.fit_transform(rf_features['settlement'])
    rf_target_encoded = department_encoder.fit_transform(rf_target)

    # אימון המודל
    X_train_rf, X_test_rf, y_train_rf, y_test_rf = train_test_split(
        rf_features, rf_target_encoded, test_size=0.2, random_state=42
    )

    rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
    rf_model.fit(X_train_rf, y_train_rf)

    rf_accuracy = accuracy_score(y_test_rf, rf_model.predict(X_test_rf))
    print(f"✅ RandomForest model trained. Accuracy: {rf_accuracy:.2%}")

else:
    rf_model = None
    settlement_encoder = None
    department_encoder = None


class DepartmentPredictionRequest(BaseModel):
    settlement: str
    month: int
    day_of_week: int
    temperature: float



@app.post("/predict-department")
def predict_department(request: DepartmentPredictionRequest):
    if rf_model is None:
        return {"error": "RandomForest model not available."}

    if request.settlement not in settlement_encoder.classes_:
        return {"error": f"יישוב '{request.settlement}' לא נמצא בדאטה."}

    try:
        encoded_settlement = settlement_encoder.transform([request.settlement])[0]
        input_data = pd.DataFrame([[
            encoded_settlement,
            request.month,
            request.day_of_week,
            request.temperature
        ]], columns=['settlement', 'Month', 'DayOfWeek', 'temperature'])

        prediction_encoded = rf_model.predict(input_data)
        predicted_department = department_encoder.inverse_transform(prediction_encoded)[0]

        return {"predicted_department": predicted_department}

    except Exception as e:
        return {"error": str(e)}
