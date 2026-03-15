import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../Supabase/supabaseClient";
import "./savedReports.css"; 

const SavedReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null); // Track which report is being deleted
  const navigate = useNavigate();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/");

      const { data, error } = await supabase
        .from("saved_reports")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReports(data);
    } catch (err) {
      console.error("Error fetching reports:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- NEW: DELETE LOGIC ---
  const handleDelete = async (report) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete the report for ${report.location}?`);
    if (!confirmDelete) return;

    setDeletingId(report.id);

    try {
      // 1. Extract file path from the URL to delete from Storage
      // The URL looks like: .../storage/v1/object/public/reports/USER_ID/FILE_NAME.pdf
      const urlParts = report.file_url.split('/reports/');
      const filePath = urlParts[1];

      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from('reports')
          .remove([filePath]);
        
        if (storageError) console.error("Storage deletion warning:", storageError.message);
      }

      // 2. Delete the record from the database table
      const { error: dbError } = await supabase
        .from("saved_reports")
        .delete()
        .eq("id", report.id);

      if (dbError) throw dbError;

      // 3. Update UI state
      setReports(reports.filter(r => r.id !== report.id));
      alert("Report deleted successfully.");

    } catch (err) {
      console.error("Delete error:", err.message);
      alert("Failed to delete report: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="archive-container">
      <div className="archive-header">
        <button className="archive-back-btn" onClick={() => navigate("/home")}>
          ⬅ Back to Map
        </button>
        <h1>Your Archived Reports</h1>
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading your archives...</p></div>
      ) : (
        <div className="reports-list">
          {reports.map((report) => (
            <div key={report.id} className="report-card">
              <div className="report-info">
                <h3>{report.location}</h3>
                <div className="report-date">
                  📅 {new Date(report.created_at).toLocaleDateString(undefined, { 
                    year: 'numeric', month: 'long', day: 'numeric' 
                  })}
                </div>
              </div>
              <div className="report-actions">
                <a 
                  href={report.file_url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="view-pdf-btn"
                >
                  View 📄
                </a>
                <button 
                  className="delete-report-btn"
                  onClick={() => handleDelete(report)}
                  disabled={deletingId === report.id}
                >
                  {deletingId === report.id ? "..." : "Delete 🗑️"}
                </button>
              </div>
            </div>
          ))}
          
          {!loading && reports.length === 0 && (
            <div className="empty-state">
              <h3>No reports found</h3>
              <p>Generate and save a report from the Analysis page to see it here.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SavedReports;