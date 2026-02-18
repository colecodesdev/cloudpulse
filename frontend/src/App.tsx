import { useEffect, useState } from "react";

type ServiceInstance = {
    id: number;
    name: string;
    environment: string;
    status: string;
};

function App() {
    const [services, setServices] = useState<ServiceInstance[]>([]);
    const [loading, setLoading] = useState(true);

    const loadServices = async () => {
        setLoading(true);

        try {
            const res = await fetch("http://localhost:8080/api/services");
            const data = await res.json();
            setServices(data);
        } catch {
            setServices([]);
        }

        setLoading(false);
    };

    useEffect(() => {
        loadServices();
    }, []);

    return (
        <div style={{ padding: "2rem" }}>
            <h1>CloudPulse</h1>

            <button onClick={loadServices}>Refresh</button>

            {loading ? (
                <p>Loading services...</p>
            ) : (
                <>
                    <h2>Services ({services.length})</h2>

                    {services.length === 0 ? (
                        <p>No services found.</p>
                    ) : (
                        <ul>
                            {services.map((s) => (
                                <li key={s.id}>
                                    <strong>{s.name}</strong> — {s.environment} — {s.status}
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
}

export default App;
