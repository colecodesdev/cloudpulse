import { useEffect, useMemo, useState } from "react";
import { createService, getHealth, getServices, type ServiceInstance } from "./api";
import "./App.css";

type FormState = {
  name: string;
  environment: string;
  status: string;
};

type DocSection = {
  title: string;
  purpose: string;
  why: string;
  integrate: string;
  decisions: string;
  tradeoffs: string;
  production: string;
};

function normalizeStatus(value: string) {
  return value.trim().toLowerCase();
}

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  const s = normalizeStatus(status);

  const successHints = ["healthy", "active", "ok", "running", "up"];
  const dangerHints = ["unhealthy", "down", "error", "failed", "critical", "inactive"];
  const warningHints = ["degraded", "warning", "partial"];

  if (successHints.some((h) => s.includes(h))) return "success";
  if (dangerHints.some((h) => s.includes(h))) return "danger";
  if (warningHints.some((h) => s.includes(h))) return "warning";
  return "neutral";
}

function toneLabel(tone: "success" | "warning" | "danger" | "neutral") {
  if (tone === "success") return "Healthy";
  if (tone === "danger") return "Issue";
  if (tone === "warning") return "Degraded";
  return "Unknown";
}

const DOCS: DocSection[] = [
  {
    title: "Frontend Layer",
    purpose:
      "Provide a minimal cloud-console UI for creating and viewing service records via the backend API.",
    why:
      "The UI makes the architecture tangible: it exercises nginx proxying, the API, database persistence, and deployment flow in one place.",
    integrate:
      "The browser loads the React SPA from nginx. API calls use relative paths (/api/...) which nginx proxies to the backend.",
    decisions:
      "React + TypeScript + Vite for fast iteration. The UI is intentionally small: a create form and a services view.",
    tradeoffs:
      "No authentication, no complex routing, and no multi-page admin features. This is a guided demo, not a full product UI.",
    production:
      "A production UI would add authentication/authorization, richer navigation, UX instrumentation, and more robust error handling.",
  },
  {
    title: "Reverse Proxy (nginx)",
    purpose:
      "Serve the frontend SPA and proxy /api requests to the backend on the same host.",
    why:
      "It provides a clean boundary between UI and API and keeps production requests same-origin.",
    integrate:
      "nginx listens on port 80. It serves static assets and proxies /api to http://127.0.0.1:8080.",
    decisions:
      "Single nginx instance inside the ECS task. SPA routing uses try_files (fallback to index.html).",
    tradeoffs:
      "No TLS termination, no load balancer, and minimal routing logic beyond /api proxying.",
    production:
      "Production commonly terminates TLS at an ALB/CloudFront and adds stricter headers, caching, and ingress controls.",
  },
  {
    title: "Backend API (Spring Boot)",
    purpose:
      "Expose a minimal REST API that demonstrates persistence behind nginx.",
    why:
      "A backend adds a realistic request chain and enables database writes/reads via a standard API.",
    integrate:
      "Runs on port 8080. nginx proxies /api to the backend. Endpoints include GET /api/health and GET/POST /api/services.",
    decisions:
      "Spring Boot (Java 17) with JPA/Hibernate mapped to a single entity/table (service_instances).",
    tradeoffs:
      "Minimal domain logic and no migrations/auth. The scope is intentionally constrained to highlight the deployment architecture.",
    production:
      "Production typically adds migrations, validation, auth, metrics/tracing, and stronger error contracts.",
  },
  {
    title: "Database (PostgreSQL)",
    purpose:
      "Persist service records to demonstrate stateful infrastructure and container dependency ordering.",
    why:
      "A database adds realism: deployments must account for persistence, storage, and service connectivity.",
    integrate:
      "PostgreSQL runs in the same ECS task. The backend connects locally. Data lives in cloudpulse.service_instances.",
    decisions:
      "PostgreSQL 16 in a container with a host-mounted volume at /opt/cloudpulse/pgdata.",
    tradeoffs:
      "No managed RDS, no migration tooling, and limited durability compared to managed storage.",
    production:
      "Production commonly uses RDS, backups, migrations, and stricter access controls.",
  },
  {
    title: "Containerization Strategy (Docker + ECS Task)",
    purpose:
      "Run frontend, backend, and database as containers within a single ECS task on one EC2 instance.",
    why:
      "Demonstrates a production-style deployment pipeline while staying intentionally minimal and low-cost.",
    integrate:
      "One ECS task includes postgres, backend, and frontend. Startup ordering uses container dependencies and health checks.",
    decisions:
      "networkMode = host. backend depends on postgres HEALTHY; frontend depends on backend START.",
    tradeoffs:
      "Host networking couples tasks to host ports and reduces isolation. Single-instance design reduces resiliency.",
    production:
      "Production typically splits services, adds load balancing/service discovery, uses private networking, and relies on managed databases.",
  },
  {
    title: "Infrastructure as Code (Terraform)",
    purpose:
      "Define AWS resources in a repeatable, versioned way.",
    why:
      "IaC enables reproducible environments, auditability, and alignment between repo and deployed infrastructure.",
    integrate:
      "Separate bootstrap and app stacks. Remote state in S3 with DynamoDB state locking.",
    decisions:
      "Minimal VPC (public subnets + IGW), ECS cluster on EC2, capacity provider via ASG locked to size 1.",
    tradeoffs:
      "Intentionally avoids ALB/NAT/private subnets to reduce cost and complexity.",
    production:
      "Production usually adds private subnets, NAT, load balancers, tighter IAM, and deeper monitoring.",
  },
  {
    title: "AWS Deployment Model (ECS on EC2)",
    purpose:
      "Deploy containers with ECS using EC2 capacity for low-cost control over compute.",
    why:
      "Demonstrates orchestration concepts (cluster, task, instance) and deployment updates without enterprise overhead.",
    integrate:
      "An ECS cluster runs tasks on a single t3.micro via an ASG/capacity provider. Images are pulled from ECR.",
    decisions:
      "desired_capacity = 1 and no load balancer. Public access is only port 80.",
    tradeoffs:
      "Single point of failure and no horizontal scaling. This is intentionally constrained for cost.",
    production:
      "Production scales across instances/AZs with health-based deployments and load balancing.",
  },
  {
    title: "Networking Model",
    purpose:
      "Keep the environment reachable on port 80 while minimizing exposed surface area.",
    why:
      "A minimal VPC design reduces cost while still demonstrating practical network boundaries.",
    integrate:
      "VPC with 2 public subnets and an Internet Gateway. Security group allows inbound TCP 80 from 0.0.0.0/0.",
    decisions:
      "No private subnets and no NAT gateway. Only nginx is exposed publicly.",
    tradeoffs:
      "Workloads run in public subnets. Cheaper and simpler, but not ideal for production security posture.",
    production:
      "Production commonly isolates workloads in private subnets and uses NAT/egress controls with tighter inbound rules.",
  },
  {
    title: "Security Boundaries",
    purpose:
      "Enforce a minimal perimeter using the EC2 security group while keeping backend/db ports closed publicly.",
    why:
      "Demonstrates basic port exposure discipline even in a low-cost environment.",
    integrate:
      "Security group exposes only port 80. With host networking, containers bind to host ports; the SG blocks 8080/5432 from the internet.",
    decisions:
      "No TLS, no ALB, and no Secrets Manager. Environment variables are injected directly.",
    tradeoffs:
      "Suitable for a guided demo only. Secrets handling and encryption are intentionally simplified.",
    production:
      "Production uses TLS, secrets management, IAM hardening, and layered network controls.",
  },
  {
    title: "Observability (CloudWatch Logs)",
    purpose:
      "Capture container logs in CloudWatch for basic debugging and visibility.",
    why:
      "Even minimal systems need observability to diagnose issues across services and deployments.",
    integrate:
      "Containers use the awslogs driver to send logs to CloudWatch.",
    decisions:
      "Logs-only approach for simplicity. No metrics dashboards or tracing.",
    tradeoffs:
      "Limited visibility into performance and latency. Enough for a demo but not for production operations.",
    production:
      "Production adds metrics, alarms, dashboards, tracing, and structured logging.",
  },
  {
    title: "CI/CD Pipeline",
    purpose:
      "Build and publish images to ECR automatically on pushes to main.",
    why:
      "A repeatable delivery pipeline demonstrates real deployment automation.",
    integrate:
      "GitHub Actions builds images, pushes to ECR, and updates ECS deployment using OIDC role assumption.",
    decisions:
      "OIDC is used; no static AWS credentials are stored in the repo.",
    tradeoffs:
      "Pipeline is intentionally minimal: build/push/deploy without complex approvals or environment promotion.",
    production:
      "Production includes staged environments, approvals, rollbacks, and deeper test automation.",
  },
  {
    title: "Cost Optimization Decisions",
    purpose:
      "Demonstrate a production-style deployment under strict cost constraints.",
    why:
      "Avoids expensive managed components while preserving the core concepts (IaC, containers, delivery pipeline).",
    integrate:
      "Single t3.micro, no ALB, no NAT, no RDS, and a single ECS task running all containers.",
    decisions:
      "Public-only VPC, host networking, minimal AWS services, and conservative resource footprint.",
    tradeoffs:
      "Lower resiliency and fewer security layers than production. Constraints are intentional and documented.",
    production:
      "Production increases cost to buy reliability: multi-AZ, load balancing, managed databases, and layered security.",
  },
  {
    title: "Architectural Tradeoffs",
    purpose:
      "Make the intentional constraints explicit and explain what is gained and lost.",
    why:
      "Tradeoffs communicate engineering judgment: cost vs resiliency and simplicity vs flexibility.",
    integrate:
      "Single host, single task, minimal network layers, and logs-only observability.",
    decisions:
      "Optimize for clarity and cost: demonstrate the chain and deployment mechanics without enterprise complexity.",
    tradeoffs:
      "Single point of failure, no TLS, no managed database, limited isolation with host networking.",
    production:
      "Production accepts more complexity for reliability, security, and operational maturity.",
  },
  {
    title: "What Would Change in Production",
    purpose:
      "Outline the practical delta between this demo and a production-grade environment.",
    why:
      "Shows the constraints are intentional and distinguishes a guided demo from a hardened system.",
    integrate:
      "Would touch networking, security, scaling, storage, and observability.",
    decisions:
      "Kept separate from the rest so the panels document what exists while acknowledging real-world differences.",
    tradeoffs:
      "Descriptive only. This panel does not change the deployed architecture.",
    production:
      "TLS + ALB, private subnets + NAT, RDS, scaling across instances/AZs, secrets management, and deeper monitoring.",
  },
];

type SortKey = "name" | "environment" | "status" | "id";

function App() {
  const [services, setServices] = useState<ServiceInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [health, setHealth] = useState<"checking" | "ok" | "fail">("checking");

  const [form, setForm] = useState<FormState>({
    name: "",
    environment: "",
    status: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const [openDocIndex, setOpenDocIndex] = useState<number>(0);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [copiedId, setCopiedId] = useState<number | null>(null);

  const canSubmit = useMemo(() => {
    return (
      form.name.trim().length > 0 &&
      form.environment.trim().length > 0 &&
      form.status.trim().length > 0
    );
  }, [form]);

  const loadHealth = async () => {
    setHealth("checking");
    try {
      const ok = await getHealth();
      setHealth(ok ? "ok" : "fail");
    } catch {
      setHealth("fail");
    }
  };

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

  const refreshAll = async () => {
    await Promise.all([loadHealth(), loadServices()]);
  };

  const submitService = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);

    if (!canSubmit) {
      setSubmitError("Please fill out all required fields.");
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
      setAttemptedSubmit(false);
      await refreshAll();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to create service");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    if (copiedId === null) return;
    const t = window.setTimeout(() => setCopiedId(null), 1400);
    return () => window.clearTimeout(t);
  }, [copiedId]);

  const statusPill = useMemo(() => {
    if (loadError) return { tone: "danger" as const, text: "API Error" };
    if (health === "checking") return { tone: "neutral" as const, text: "Checking" };
    if (health === "fail") return { tone: "warning" as const, text: "Health Check Failed" };
    return { tone: "success" as const, text: "System Online" };
  }, [health, loadError]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        s.environment.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q) ||
        String(s.id).includes(q)
      );
    });
  }, [services, query]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "id") return (a.id - b.id) * dir;
      const av = String((a as any)[sortKey]).toLowerCase();
      const bv = String((b as any)[sortKey]).toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const nameInvalid = attemptedSubmit && form.name.trim().length === 0;
  const envInvalid = attemptedSubmit && form.environment.trim().length === 0;
  const statusInvalid = attemptedSubmit && form.status.trim().length === 0;

  const copyId = async (id: number) => {
    try {
      await navigator.clipboard.writeText(String(id));
      setCopiedId(id);
    } catch {
      setCopiedId(null);
    }
  };

  return (
    <div className="layout">
      <aside className="sidebar">

        <div className="sidebar-section">
          <div className="sidebar-header">
            <div className="sidebar-title">Documentation</div>
            <div className="pill mini">
              <span className="dot warning" />
              <span>Verified state</span>
            </div>
          </div>

          <div className="sidebar-desc">
            These panels document what is currently deployed. They do not describe an idealized architecture.
          </div>

          <div className="accordion">
            {DOCS.map((s, idx) => {
              const active = idx === openDocIndex;
              return (
                <div key={s.title} className={`acc-group ${active ? "active" : ""}`}>
                  <button
                    type="button"
                    className={`acc-item ${active ? "active" : ""}`}
                    onClick={() => setOpenDocIndex(active ? -1 : idx)}
                    aria-expanded={active}
                  >
                    <span>{s.title}</span>
                    <span className="chev">{active ? "⌄" : "›"}</span>
                  </button>

                  {active ? (
                    <div className="acc-panel">
                      <div className="acc-block">
                        <div className="acc-label">Purpose</div>
                        <div className="acc-text">{s.purpose}</div>
                      </div>

                      <div className="acc-block">
                        <div className="acc-label">Why It Exists</div>
                        <div className="acc-text">{s.why}</div>
                      </div>

                      <div className="acc-block">
                        <div className="acc-label">How It Integrates</div>
                        <div className="acc-text">{s.integrate}</div>
                      </div>

                      <div className="acc-block">
                        <div className="acc-label">Design Decisions</div>
                        <div className="acc-text">{s.decisions}</div>
                      </div>

                      <div className="acc-block">
                        <div className="acc-label">Tradeoffs / Constraints</div>
                        <div className="acc-text">{s.tradeoffs}</div>
                      </div>

                      <div className="acc-block">
                        <div className="acc-label">Production Considerations</div>
                        <div className="acc-text">{s.production}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="main-inner">
          <div className="topbar">
            <div className="brand">
              <h1>CloudPulse Console</h1>
              <div className="subtle">Minimal-cost deployment walkthrough (ECS on EC2)</div>
              <div className="pathline">
                <span className="pathchip">Browser</span>
                <span className="pathsep">→</span>
                <span className="pathchip">nginx:80</span>
                <span className="pathsep">→</span>
                <span className="pathchip">Spring Boot:8080</span>
                <span className="pathsep">→</span>
                <span className="pathchip">PostgreSQL:5432</span>
              </div>
            </div>

            <div className="row">
              <div className="pill">
                <span className={`dot ${statusPill.tone}`} />
                <span>{statusPill.text}</span>
              </div>

              <button type="button" onClick={refreshAll} disabled={loading}>
                {loading ? "Refreshing…" : "Refresh"}
              </button>

                <a
                    href="https://github.com/colecodesdev/cloudpulse"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="githubBtn"
                    title="View Repository"
                >
                    <svg
                        height="18"
                        width="18"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                    >
                        <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 005.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.22.48-2.69-1.07-2.69-1.07-.36-.91-.88-1.15-.88-1.15-.72-.49.05-.48.05-.48.8.06 1.22.82 1.22.82.71 1.22 1.87.87 2.33.67.07-.52.28-.87.5-1.07-1.77-.2-3.64-.89-3.64-3.95 0-.87.31-1.58.82-2.14-.08-.2-.36-1.02.08-2.13 0 0 .67-.21 2.2.82a7.6 7.6 0 012 0c1.53-1.03 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.27.82 2.14 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0016 8c0-4.42-3.58-8-8-8z" />
                    </svg>
                </a>
            </div>
          </div>

          <div className="card overview">
            <div className="overview-title">System Overview</div>
            <div className="overview-grid">
              <div className="kv">
                <div className="k">Deployment</div>
                <div className="v">AWS ECS (EC2 launch type) · single t3.micro</div>
              </div>
              <div className="kv">
                <div className="k">Networking</div>
                <div className="v">host mode · port 80 public · 8080/5432 not public</div>
              </div>
              <div className="kv">
                <div className="k">Proxy</div>
                <div className="v">nginx :80 → backend 127.0.0.1:8080</div>
              </div>
              <div className="kv">
                <div className="k">Data</div>
                <div className="v">PostgreSQL 16 · volume /opt/cloudpulse/pgdata</div>
              </div>
              <div className="kv">
                <div className="k">Logging</div>
                <div className="v">CloudWatch logs via awslogs driver</div>
              </div>
              <div className="kv">
                <div className="k">CI/CD</div>
                <div className="v">GitHub Actions → ECR → ECS deploy (OIDC)</div>
              </div>
            </div>
          </div>

          <div className="content-grid">
            <div className="card">
              <div className="card-header">
                <h2>Create Service</h2>
                <div className="pill">
                  <span className="dot success" />
                  <span>POST /api/services</span>
                </div>
              </div>

              <div className="helper">
                Adds a service record to demonstrate a console workflow (form → API → database → UI refresh).
              </div>

              <div className="hr" />

              <form onSubmit={submitService} className="stack">
                <div className="field">
                  <div className="label">
                    Name <span className="req">*</span>
                  </div>
                  <input
                    value={form.name}
                    onChange={(ev) => setForm((p) => ({ ...p, name: ev.target.value }))}
                    aria-invalid={nameInvalid}
                    className={nameInvalid ? "invalid" : ""}
                  />
                  {nameInvalid ? <div className="field-error">Required</div> : null}
                </div>

                <div className="field">
                  <div className="label">
                    Environment <span className="req">*</span>
                  </div>
                  <input
                    value={form.environment}
                    onChange={(ev) => setForm((p) => ({ ...p, environment: ev.target.value }))}
                    aria-invalid={envInvalid}
                    className={envInvalid ? "invalid" : ""}
                  />
                  {envInvalid ? <div className="field-error">Required</div> : null}
                </div>

                <div className="field">
                  <div className="label">
                    Status <span className="req">*</span>
                  </div>
                  <input
                    value={form.status}
                    onChange={(ev) => setForm((p) => ({ ...p, status: ev.target.value }))}
                    aria-invalid={statusInvalid}
                    className={statusInvalid ? "invalid" : ""}
                  />
                  {statusInvalid ? <div className="field-error">Required</div> : null}
                </div>

                <button type="submit" disabled={!canSubmit || submitting}>
                  {submitting ? "Creating…" : "Create"}
                </button>

                {submitError ? <div className="alert">Error: {submitError}</div> : null}
              </form>
            </div>

            <div className="card">
              <div className="card-header services-head">
                <div>
                  <h2>Services</h2>
                  <div className="helper">Stored in PostgreSQL (service_instances) and retrieved via GET /api/services.</div>
                </div>

                <div className="services-actions">
                  <div className="pill mini">
                    <span className="dot success" />
                    <span>{services.length} total</span>
                  </div>
                </div>
              </div>

              <div className="hr" />

              <div className="table-tools">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, env, status, id"
                />
                <div className="tool-row">
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    aria-label="Sort key"
                  >
                    <option value="id">Sort: ID</option>
                    <option value="name">Sort: Name</option>
                    <option value="environment">Sort: Environment</option>
                    <option value="status">Sort: Status</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                  >
                    {sortDir === "asc" ? "Asc" : "Desc"}
                  </button>
                </div>
              </div>

              {loading ? <div className="helper">Loading services…</div> : null}
              {loadError ? <div className="alert">Error: {loadError}</div> : null}

              {!loading && !loadError && services.length === 0 ? (
                <div className="empty">
                  <div className="empty-title">No services yet</div>
                  <div className="empty-sub">
                    Create your first service to exercise the full request chain (nginx → API → database → UI).
                  </div>
                </div>
              ) : null}

              {!loading && !loadError && services.length > 0 && sorted.length === 0 ? (
                <div className="empty">
                  <div className="empty-title">No matches</div>
                  <div className="empty-sub">Try a different search term.</div>
                </div>
              ) : null}

              {!loading && !loadError && sorted.length > 0 ? (
                <div className="table">
                  <div className="thead">
                    <div>Name</div>
                    <div>Environment</div>
                    <div>Status</div>
                    <div className="right">ID</div>
                  </div>

                  <div className="tbody">
                    {sorted.map((s) => {
                      const tone = statusTone(s.status);
                      const label = toneLabel(tone);
                      return (
                        <div key={s.id} className="tr">
                          <div className="cell strong">{s.name}</div>
                          <div className="cell muted">{s.environment}</div>
                          <div className="cell">
                            <div className={`badge ${tone}`} title={s.status}>
                              <span className={`dot ${tone}`} />
                              <span>{label}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="cell right muted idbtn"
                            onClick={() => copyId(s.id)}
                            title="Copy ID"
                          >
                            {copiedId === s.id ? "Copied" : s.id}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          </div>
      </main>
    </div>
  );
}

export default App;
