export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export type ServiceInstance = {
    id: number;
    name: string;
    environment: string;
    status: string;
};

export async function getServices(): Promise<ServiceInstance[]> {
    const res = await fetch(`${API_BASE_URL}/api/services`);
    if (!res.ok) {
        throw new Error(`GET /api/services failed: ${res.status}`);
    }
    return res.json();
}

export async function createService(input: {
    name: string;
    environment: string;
    status: string;
}): Promise<ServiceInstance> {
    const res = await fetch(`${API_BASE_URL}/api/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`POST /api/services failed: ${res.status} ${text}`);
    }

    return res.json();
}
