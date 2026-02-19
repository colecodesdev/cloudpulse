import { useEffect, useMemo, useState } from "react";
import { createService, getServices, type ServiceInstance } from "./api";

type FormState = {
    name: string;
    environment: string;
    status: string;
};

function App() {
    const [services, setServices] = useState<ServiceInstance[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [form, setForm] = useState<FormState>({
        name: "",
        environment: "",
        status: "",
    });

    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const canSubmit = useMemo(() => {
        return (
            form.name.trim().length > 0 &&
            form.environment.trim().length > 0 &&
            form.status.trim().length > 0
        );
    }, [form]);

    const loadServices = async () => {
        setLoading(true);
        setLoadError(null);

        try {
            const data = await getServices();
            setServices(data);
        } catch (e) {
            setServices([]);
            setLoadError(e instanceof Error ? e.message : "Failed to load services");
        } finally {
            setLoading(false);
        }
    };

    const submitService = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!canSubmit) {
            setSubmitError("Please fill out all fields.");
            return;
        }

        setSubmitting(true);
        setSubmitError(null);

        try {
            await createService({
                name: form.name.trim(),
                environment: form.environment.trim(),
                status: form.status.trim(),
            });

            setForm({ name: "", environment: "", status: "" });
            await loadServices();
        } catch (e) {
            setSubmitError(e instanceof Error ? e.message : "Failed to create service");
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        loadServices();
    }, []);

    return (
        <div style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
            <h1>CloudPulse</h1>

            <div style={{ marginTop: "1.25rem" }}>
                <h2>Create Service</h2>

                <form onSubmit={submitService} style={{ display: "grid", gap: "0.75rem" }}>
                    <label style={{ display: "grid", gap: "0.25rem" }}>
                        <span>Name</span>
                        <input
                            value={form.name}
                            onChange={(ev) => setForm((p) => ({ ...p, name: ev.target.value }))}
                            placeholder="demo-service"
                        />
                    </label>

                    <label style={{ display: "grid", gap: "0.25rem" }}>
                        <span>Environment</span>
                        <input
                            value={form.environment}
                            onChange={(ev) =>
                                setForm((p) => ({ ...p, environment: ev.target.value }))
                            }
                            placeholder="local"
                        />
                    </label>

                    <label style={{ display: "grid", gap: "0.25rem" }}>
                        <span>Status</span>
                        <input
                            value={form.status}
                            onChange={(ev) => setForm((p) => ({ ...p, status: ev.target.value }))}
                            placeholder="healthy"
                        />
                    </label>

                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                        <button type="submit" disabled={!canSubmit || submitting}>
                            {submitting ? "Creating..." : "Create"}
                        </button>
                        <button type="button" onClick={loadServices} disabled={loading}>
                            Refresh
                        </button>
                    </div>

                    {submitError ? <p style={{ margin: 0 }}>Error: {submitError}</p> : null}
                </form>
            </div>

            <div style={{ marginTop: "2rem" }}>
                <h2>Services</h2>

                {loading ? <p>Loading services...</p> : null}
                {loadError ? <p>Error: {loadError}</p> : null}

                {!loading && !loadError && services.length === 0 ? (
                    <p>No services found.</p>
                ) : null}

                {!loading && !loadError && services.length > 0 ? (
                    <ul style={{ paddingLeft: "1.25rem" }}>
                        {services.map((s) => (
                            <li key={s.id}>
                                <strong>{s.name}</strong> — {s.environment} — {s.status}
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
        </div>
    );
}

export default App;
