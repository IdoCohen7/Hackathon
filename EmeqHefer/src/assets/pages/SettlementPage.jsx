import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";

const COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff8042",
  "#00C49F",
  "#FFBB28",
];

// שמות החודשים בעברית
const MONTHS_HEBREW = [
  "", // 0
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

export default function SettlementPage() {
  const { name } = useParams();
  const decodedName = decodeURIComponent(name);

  const [topicsData, setTopicsData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [avgDurationData, setAvgDurationData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettlementData = async () => {
      try {
        const [topicsRes, monthlyRes, avgDurationRes] = await Promise.all([
          axios.get(`http://localhost:8000/analytics/topics/${decodedName}`),
          axios.get(`http://localhost:8000/analytics/monthly/${decodedName}`),
          axios.get(
            `http://localhost:8000/analytics/avg-duration/${decodedName}`
          ),
        ]);

        setTopicsData(topicsRes.data.topics || []);

        // מיפוי חודשי שנה עם שמות חודשים
        const mappedMonthlyData = (monthlyRes.data.monthly_counts || []).map(
          (item) => ({
            monthNumber: item.month,
            count: item.count,
          })
        );

        // סידור לפי החודש הנוכחי תחילה + הצגת שנה
        const today = new Date();
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const startMonth = oneYearAgo.getMonth() + 1;
        const startYear = oneYearAgo.getFullYear();

        const reorderedMonthlyData = [];

        for (let i = 0; i < 12; i++) {
          const monthNumber = ((startMonth + i - 1) % 12) + 1;
          const yearOffset = Math.floor((startMonth + i - 1) / 12);
          const year = startYear + yearOffset;

          const foundMonth = mappedMonthlyData.find(
            (m) => m.monthNumber === monthNumber
          );
          const count = foundMonth ? foundMonth.count : 0;

          reorderedMonthlyData.push({
            monthDisplay: `${MONTHS_HEBREW[monthNumber]} ${year}`,
            count: count,
          });
        }

        setMonthlyData(reorderedMonthlyData);

        // עיבוד ממוצע זמן טיפול
        const mappedAvgDuration = (avgDurationRes.data.avg_durations || []).map(
          (item) => ({
            topic: item.topic,
            days: parseFloat((item.avgDuration / (60 * 24)).toFixed(2)), // המרה לימים
          })
        );
        setAvgDurationData(mappedAvgDuration);
      } catch (error) {
        console.error("❌ שגיאה בקבלת נתונים על היישוב:", error);
      } finally {
        setLoading(false);
      }
    };

    if (decodedName) {
      fetchSettlementData();
    }
  }, [decodedName]);

  if (loading) {
    return (
      <div
        className="container d-flex align-items-center justify-content-center"
        style={{ height: "80vh" }}
      >
        <div className="text-center">
          <div
            className="spinner-border text-primary"
            role="status"
            style={{ width: "4rem", height: "4rem" }}
          >
            <span className="visually-hidden">טוען...</span>
          </div>
          <p className="mt-3">טוען נתונים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h2 className="text-2xl font-bold mb-4">מידע על היישוב: {decodedName}</h2>

      {/* גרף עוגה - פניות לפי נושא */}
      <div className="card p-4 mb-5 shadow-sm">
        <h4 className="text-lg font-semibold mb-2 text-center">
          פניות לפי נושא
        </h4>
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={topicsData}
              dataKey="count"
              nameKey="topic"
              cx="50%"
              cy="50%"
              outerRadius={140}
              fill="#8884d8"
              label
              isAnimationActive={true}
              animationDuration={1000}
              animationEasing="ease-out"
            >
              {topicsData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        <p className="text-muted small text-center mt-2">
          מציגים את 10 הנושאים המובילים בלבד
        </p>
      </div>

      {/* גרף קו - פניות לפי חודשים */}
      <div className="card p-4 mb-5 shadow-sm">
        <h4 className="text-lg font-semibold mb-2 text-center">
          פניות לפי חודשים
        </h4>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="monthDisplay" />
            <YAxis
              label={{
                value: "מספר פניות",
                angle: -90,
                position: "insideLeft",
              }}
            />
            <Tooltip formatter={(value) => [`${value}`, "מספר פניות"]} />
            <Legend />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#82ca9d"
              activeDot={{ r: 8 }}
              isAnimationActive={true}
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* גרף עמודות - זמן טיפול ממוצע לפי נושא */}
      <div className="card p-4 mb-5 shadow-sm">
        <h4 className="text-lg font-semibold mb-2 text-center">
          זמן טיפול ממוצע לפי נושא (בימים)
        </h4>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={avgDurationData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="topic"
              interval={0}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis
              label={{
                value: "מספר ימים בממוצע",
                angle: -90,
                position: "insideLeft",
              }}
            />
            <Tooltip formatter={(value) => [`${value}`, "מספר ימים בממוצע"]} />
            <Legend />
            <Bar
              dataKey="days"
              fill="#8884d8"
              isAnimationActive={true}
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-muted small text-center mt-2">
          מציגים את 10 הנושאים המובילים בלבד
        </p>
      </div>
    </div>
  );
}
