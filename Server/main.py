# 📦 שרת FastAPI מלא עם MongoDB + מודל XGBoost על בסיס דאטא מהמסד

from fastapi import FastAPI
from pymongo import MongoClient
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import xgboost as xgb
from datetime import date

# יצירת אפליקציה
app = FastAPI()

# חיבור למונגו לוקאלי
client = MongoClient("mongodb://localhost:27017/")
db = client["emeq_hefer_db"]
requests_collection = db["requests"]

# הפעלת CORS לכל הדומיינים
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- טעינת מודל החיזוי מדאטא במסד ---
try:
    requests_data = list(requests_collection.find({}, {"_id": 0}))
    df = pd.DataFrame(requests_data)
except Exception:
    df = None

if df is not None:
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

# --- מודל לקבלת קלט עבור חיזוי ---
class PredictionRequest(BaseModel):
    settlement: str
    temperature: float
    predict_date: str  # YYYY-MM-DD

# --- פונקציה פנימית לחיזוי ---
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

# --- ראוטים ---
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

@app.get("/requests/{settlement}")
def get_requests_by_settlement(settlement: str):
    try:
        results = list(requests_collection.find({"settlement": settlement}, {"_id": 0}))
        return {"requests": results}
    except Exception as e:
        return {"error": str(e)}

@app.get("/test")
def test_endpoint():
    try:
        example_request = requests_collection.find_one({}, {"_id": 0})
        if example_request:
            return {"example_request": example_request}
        else:
            return {"message": "No documents found in the collection."}
    except Exception as e:
        return {"error": str(e)}

@app.get("/requests/in-progress/count")
def get_in_progress_requests_count():
    try:
        base_filter = {"status": {"$nin": ["הטיפול הסתיים", "נסגר בעקבות אי מענה של הפונה"]}}

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

@app.post("/predict")
def predict(request: PredictionRequest):
    if final_model is None:
        return {"error": "Model not available."}
    predict_date = pd.to_datetime(request.predict_date)
    predicted_complaints = predict_single_locality(
        locality_name=request.settlement,
        temp=request.temperature,
        predict_date=predict_date
    )
    return {"predicted_complaints": predicted_complaints}

@app.post("/predict/all")
def predict_all_localities(temp: float, predict_date: str):
    if final_model is None:
        return {"error": "Model not available."}
    predict_date = pd.to_datetime(predict_date)
    
    results = []
    total = 0
    
    # נעבור על כל הישובים שנלמדו (ע״י One-Hot)
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


# uvicorn main:app --reload --host 0.0.0.0 --port 8000
