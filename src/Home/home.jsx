import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../Supabase/supabaseClient";

const Home = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/"); // Redirect to login if no user
      } else {
        setUser(session.user);
      }
    });
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div>
      <h1>Welcome Home, {user.email}</h1>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
};

export default Home;