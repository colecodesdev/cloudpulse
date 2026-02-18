import { useEffect, useState } from "react";

function App() {
    const [status, setStatus] = useState("Loading...");

    useEffect(() => {
        fetch("http://localhost:8080/api/health")
            .then((res) => res.text())
            .then((data) => setStatus(data))
            .catch(() => setStatus("Backend not reachable"));
    }, []);

    return (
        <div style={{ padding: "2rem" }}>
            <h1>CloudPulse</h1>
            <p>Backend Status: {status}</p>
        </div>
    );
}

export default App;
