# 📦 שרת FastAPI בסיסי ומעודכן להתחברות ל-MongoDB לוקאלי

from fastapi import FastAPI
from pymongo import MongoClient
from fastapi.middleware.cors import CORSMiddleware

# יצירת אפליקציה
app = FastAPI()

# חיבור למונגו לוקאלי (localhost:27017)
client = MongoClient("mongodb://localhost:27017/")
db = client["emeq_hefer_db"]
requests_collection = db["requests"]

# הפעלת CORS לכל הדומיינים (כדי ש-React יוכל לדבר עם השרת)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# בדיקה שהשרת חי
@app.get("/")
def read_root():
    return {"message": "FastAPI server is running successfully 🚀"}

# קבלת כל הקריאות מהמונגו
@app.get("/requests")
def get_all_requests():
    try:
        requests = list(requests_collection.find({}, {"_id": 0}))
        return {"requests": requests}
    except Exception as e:
        return {"error": str(e)}

# קבלת קריאות לפי יישוב
@app.get("/requests/{settlement}")
def get_requests_by_settlement(settlement: str):
    try:
        results = list(requests_collection.find({"settlement": settlement}, {"_id": 0}))
        return {"requests": results}
    except Exception as e:
        return {"error": str(e)}

# פונקציה לבדיקה כללית נוספת
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
    
# פונקציה לקבלת מספר הקריאות שעדיין בטיפול
@app.get("/requests/in-progress/count")
@app.get("/requests/in-progress/count")
def get_in_progress_requests_count():
    try:
        base_filter = {
            "status": {"$nin": ["הטיפול הסתיים", "נסגר בעקבות אי מענה של הפונה"]}
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



# uvicorn main:app --reload --host 0.0.0.0 --port 8000
