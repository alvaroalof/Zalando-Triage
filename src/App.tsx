import { useState, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  Mail, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Copy, 
  RefreshCcw,
  Tag,
  MessageSquare,
  User,
  Zap,
  History,
  CheckCircle,
  LogIn
} from "lucide-react";
import { triageEmail, TriageResult } from "./services/geminiService";
import { cn } from "./lib/utils";
import { db, auth, handleFirestoreError, OperationType } from "./lib/firebase";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp, 
  updateDoc, 
  doc,
  Timestamp
} from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";

const EXAMPLES = [
  {
    title: "Entrega Fallida / Frustrado",
    text: "Pedido ZA-4433: La caja llegó abierta y falta una de las camisas. Estoy muy decepcionado con el servicio de entrega."
  },
  {
    title: "Facturación / Calmado",
    text: "Hola, me gustaría saber cómo puedo solicitar una factura de mi compra ZA-8822. El proceso en la web no me queda claro. Gracias."
  },
  {
    title: "Cambio Talla / Urgente",
    text: "¡URGENTE! He recibido los zapatos ZA-1122 pero son una 42 y pedí una 44. Los necesito para una ceremonia mañana por la mañana. ¿Hay alguna tienda física donde pueda cambiarlos hoy?"
  },
  {
    title: "Devolución / Calmado",
    text: "Quiero devolver el vestido del pedido ZA-5566. No me gusta cómo queda el tejido. ¿Me podéis enviar la etiqueta de devolución?"
  }
];

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: any }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    const { hasError, error } = this.state;
    if (hasError) {
      let errorMessage = "Algo salió mal.";
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error === "Missing or insufficient permissions.") {
          errorMessage = "No tienes permisos suficientes para realizar esta acción. Por favor, asegúrate de haber iniciado sesión correctamente.";
        }
      } catch (e) {
        errorMessage = error?.message || errorMessage;
      }

      return (
        <div className="h-screen flex items-center justify-center bg-bg p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-200 text-center max-w-md w-full space-y-4">
            <AlertCircle className="w-12 h-12 text-error mx-auto" />
            <h2 className="text-xl font-bold text-ink uppercase tracking-tight">Error de Aplicación</h2>
            <p className="text-sm text-[#666] italic">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-ink text-white py-2 rounded-lg font-bold hover:bg-accent transition-all"
            >
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

function AppContent() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingIndex, setProcessingIndex] = useState<number | null>(null);
  const [incidents, setIncidents] = useState<TriageResult[]>([]);
  const [user, setUser] = useState(auth.currentUser);
  const [view, setView] = useState<"triage" | "history">("triage");
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewTriage, setIsNewTriage] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((u) => {
      setUser(u);
    });

    const q = query(collection(db, "incidents"), orderBy("createdAt", "desc"));
    const unsubscribeIncidents = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString()
      })) as TriageResult[];
      setIncidents(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "incidents");
    });

    return () => {
      unsubscribeAuth();
      unsubscribeIncidents();
    };
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      console.error("Login error:", err);
    }
  };

  const handleTriage = async (text: string = input) => {
    if (!text.trim() || !user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await triageEmail(text);
      setResult({ ...data, emailText: text });
      setIsNewTriage(true);
    } catch (err) {
      setError("Error al procesar el correo. Por favor, inténtalo de nuevo.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveIncident = async (status: "pending" | "resolved") => {
    if (!result || !user) return;
    try {
      const docRef = await addDoc(collection(db, "incidents"), {
        ...result,
        status,
        createdAt: serverTimestamp(),
        resolvedAt: status === "resolved" ? serverTimestamp() : null
      });
      setResult({ ...result, id: docRef.id, status });
      setIsNewTriage(false);
      setInput("");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "incidents");
    }
  };

  const resolveIncident = async (id: string) => {
    try {
      await updateDoc(doc(db, "incidents", id), {
        status: "resolved",
        resolvedAt: serverTimestamp()
      });
      if (result?.id === id) {
        setResult(prev => prev ? { ...prev, status: "resolved" } : null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `incidents/${id}`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const pendingIncidents = incidents.filter(i => i.status === "pending");
  const resolvedIncidents = incidents.filter(i => i.status === "resolved");

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-border text-center max-w-sm w-full space-y-6">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-accent/20">
            <Zap className="text-white w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase italic">
              Zalando <span className="text-accent">Triage</span>
            </h1>
            <p className="text-sm text-[#666] mt-2 italic">Acceso restringido para agentes autorizados.</p>
          </div>
          <button 
            onClick={login}
            className="w-full bg-ink text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-accent transition-all active:scale-95"
          >
            <LogIn className="w-5 h-5" />
            Iniciar Sesión con Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg">
      {/* Header */}
      <header className="bg-ink text-white px-6 py-3 flex justify-between items-center border-b-4 border-accent shrink-0">
        <div className="flex items-center gap-8">
          <div className="text-xl font-black tracking-tighter uppercase">
            ZALANDO <span className="font-light opacity-70">| TRIAGE INTELLIGENTE</span>
          </div>
          <nav className="flex gap-1 bg-white/5 p-1 rounded-lg">
            <button 
              onClick={() => setView("triage")}
              className={cn(
                "px-4 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                view === "triage" ? "bg-accent text-white" : "text-white/50 hover:text-white hover:bg-white/10"
              )}
            >
              <Zap className="w-3.5 h-3.5" />
              Triaje
            </button>
            <button 
              onClick={() => setView("history")}
              className={cn(
                "px-4 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                view === "history" ? "bg-accent text-white" : "text-white/50 hover:text-white hover:bg-white/10"
              )}
            >
              <History className="w-3.5 h-3.5" />
              Historial
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-[10px] font-mono text-white/40 uppercase">Agente: {user?.email}</div>
          <button 
            onClick={() => auth.signOut()}
            className="text-[10px] font-bold uppercase text-white/60 hover:text-accent transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === "triage" ? (
            <motion.div 
              key="triage"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full grid grid-cols-[350px_1fr] overflow-hidden"
            >
              {/* Left Column: Raw Feed / Input */}
              <section className="border-r border-border bg-[#EDEDED] flex flex-col overflow-hidden">
                <div className="text-[10px] uppercase tracking-widest font-bold p-3 text-[#666] border-b border-border flex justify-between items-center bg-[#E5E5E5]">
                  Cola de Entrada Real
                  <span className="bg-accent text-white px-1.5 py-0.5 rounded-full text-[9px]">
                    {pendingIncidents.length} PENDIENTES
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  <div className="bg-white p-4 rounded border border-border shadow-sm">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Pega aquí el contenido del correo..."
                      className="w-full h-32 text-xs italic text-[#444] outline-none resize-none bg-transparent"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => handleTriage()}
                        disabled={loading || !input.trim()}
                        className={cn(
                          "px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all",
                          loading || !input.trim()
                            ? "bg-border text-[#999] cursor-not-allowed"
                            : "bg-ink text-white hover:bg-accent active:scale-95"
                        )}
                      >
                        {loading ? "Procesando..." : "Ejecutar Triaje"}
                      </button>
                    </div>
                  </div>

                  {pendingIncidents.length > 0 && (
                    <div className="text-[9px] font-bold text-[#999] uppercase tracking-widest px-1 mt-4 mb-1">
                      Incidencias Pendientes
                    </div>
                  )}
                  {pendingIncidents.map((inc) => (
                    <button
                      key={inc.id}
                      onClick={() => {
                        setResult(inc);
                        setInput(inc.emailText || "");
                      }}
                      className={cn(
                        "w-full text-left p-3 bg-white rounded border border-border shadow-sm hover:border-accent transition-colors group relative",
                        result?.id === inc.id && "border-accent ring-1 ring-accent/20"
                      )}
                    >
                      <div className="font-mono text-[9px] text-[#888] mb-1 uppercase flex justify-between">
                        <span>{inc.orderId} • {new Date(inc.createdAt!).toLocaleTimeString()}</span>
                        <Clock className="w-2.5 h-2.5 text-accent" />
                      </div>
                      <p className="text-[11px] text-[#444] line-clamp-2 italic group-hover:text-ink">
                        "{inc.emailText}"
                      </p>
                    </button>
                  ))}

                  <div className="text-[9px] font-bold text-[#999] uppercase tracking-widest px-1 mt-6 mb-1">
                    Casos de Prueba (Demo)
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {EXAMPLES.map((ex, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(ex.text)}
                        className="text-left p-2 bg-[#F5F5F5] border border-border rounded hover:bg-white hover:border-accent transition-all group"
                      >
                        <div className="text-[9px] font-bold uppercase text-accent mb-0.5">{ex.title}</div>
                        <p className="text-[10px] text-[#666] line-clamp-1 italic group-hover:text-ink">"{ex.text}"</p>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Right Column: Structured View */}
              <section className="bg-white flex flex-col overflow-hidden p-4 gap-4">
                <div className="text-[10px] uppercase tracking-widest font-bold text-[#666] flex justify-between items-center">
                  Datos Estructurados (Salida AI)
                  <div className="flex gap-4">
                    {isNewTriage && result && (
                      <div className="flex gap-3">
                        <button 
                          onClick={() => saveIncident("pending")}
                          className="text-[9px] text-accent hover:underline flex items-center gap-1 font-bold"
                        >
                          <Clock className="w-3 h-3" />
                          GUARDAR PENDIENTE
                        </button>
                        <button 
                          onClick={() => saveIncident("resolved")}
                          className="text-[9px] text-success hover:underline flex items-center gap-1 font-bold"
                        >
                          <CheckCircle className="w-3 h-3" />
                          RESOLVER Y GUARDAR
                        </button>
                      </div>
                    )}
                    {!isNewTriage && result && result.status === "pending" && (
                      <button 
                        onClick={() => resolveIncident(result.id!)}
                        className="text-[9px] text-success hover:underline flex items-center gap-1 font-bold"
                      >
                        <CheckCircle className="w-3 h-3" />
                        MARCAR COMO RESUELTA
                      </button>
                    )}
                    {result && (
                      <button 
                        onClick={() => {
                          setResult(null);
                          setIsNewTriage(false);
                        }}
                        className="text-[9px] hover:text-accent transition-colors font-bold"
                      >
                        LIMPIAR VISTA
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <AnimatePresence mode="wait">
                    {loading ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="h-full flex flex-col items-center justify-center text-center space-y-4"
                      >
                        <div className="w-12 h-12 border-2 border-border border-t-accent rounded-full animate-spin" />
                        <div className="font-mono text-[11px] uppercase tracking-widest text-[#888]">
                          Analizando patrones de datos...
                        </div>
                      </motion.div>
                    ) : result ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                      >
                        <div className="flex justify-between items-start">
                          <table className="w-full border-collapse text-[13px]">
                            <thead>
                              <tr className="border-b-2 border-ink">
                                <th className="text-left p-3 font-serif italic text-[11px] uppercase text-[#555] tracking-wider">Order ID</th>
                                <th className="text-left p-3 font-serif italic text-[11px] uppercase text-[#555] tracking-wider">Categoría</th>
                                <th className="text-left p-3 font-serif italic text-[11px] uppercase text-[#555] tracking-wider">Sentimiento</th>
                                <th className="text-left p-3 font-serif italic text-[11px] uppercase text-[#555] tracking-wider">Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="hover:bg-[#F9F9F9] transition-colors">
                                <td className="p-3 border-b border-[#EEE]">
                                  <span className={cn(
                                    "font-mono font-bold px-1.5 py-0.5 rounded text-[12px]",
                                    result.orderId === "FALTANTE" ? "text-error bg-red-50" : "bg-[#EEE] text-ink"
                                  )}>
                                    {result.orderId}
                                  </span>
                                </td>
                                <td className="p-3 border-b border-[#EEE] font-medium">{result.category}</td>
                                <td className="p-3 border-b border-[#EEE]">
                                  <span className={cn(
                                    "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight",
                                    result.sentiment === "Calmado" ? "bg-[#E8F5E9] text-success" :
                                    result.sentiment === "Frustrado" ? "bg-[#FFF3E0] text-warning" :
                                    "bg-[#FFEBEE] text-error"
                                  )}>
                                    {result.sentiment}
                                  </span>
                                </td>
                                <td className="p-3 border-b border-[#EEE]">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase border",
                                    result.status === "resolved" ? "border-success text-success bg-green-50" : 
                                    result.status === "pending" ? "border-accent text-accent bg-orange-50" :
                                    "border-border text-[#999] bg-gray-50"
                                  )}>
                                    {result.status === "resolved" ? "Resuelta" : result.status === "pending" ? "Pendiente" : "Sin Guardar"}
                                  </span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-[#F9F9F9] border border-border rounded">
                            <div className="text-[10px] font-bold text-[#999] uppercase tracking-widest mb-2">Resumen Ejecutivo</div>
                            <p className="text-sm italic text-[#444]">"{result.summary}"</p>
                          </div>
                          <div className="p-4 bg-[#F9F9F9] border border-border rounded">
                            <div className="text-[10px] font-bold text-[#999] uppercase tracking-widest mb-2">Intervención Humana</div>
                            <div className="flex items-center gap-2">
                              {result.requiresHumanIntervention ? (
                                <span className="bg-error text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase">Requerida</span>
                              ) : (
                                <span className="bg-success text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase">No Requerida</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="bg-[#1E1E1E] text-[#D4D4D4] font-mono text-[11px] p-4 rounded-lg border-l-4 border-accent relative group">
                          <div className="text-[#888] mb-2">// Registro de Incidencia (Raw JSON)</div>
                          <button 
                            onClick={() => copyToClipboard(JSON.stringify(result, null, 2))}
                            className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-white/10 rounded"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <pre className="overflow-x-auto">
                            {JSON.stringify(result, null, 2)}
                          </pre>
                        </div>
                      </motion.div>
                    ) : error ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-red-50 border border-red-200 rounded p-6 text-center"
                      >
                        <AlertCircle className="w-8 h-8 text-error mx-auto mb-2" />
                        <div className="text-error font-bold text-xs uppercase tracking-widest">Error de Sistema</div>
                        <p className="text-xs text-red-700 mt-1">{error}</p>
                      </motion.div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center text-[#BBB] border-2 border-dashed border-border rounded-lg">
                        <Mail className="w-12 h-12 mb-3 opacity-20" />
                        <div className="text-[11px] font-bold uppercase tracking-[0.2em]">Esperando Entrada de Datos</div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </section>
            </motion.div>
          ) : (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full flex flex-col bg-bg p-6 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-black tracking-tighter uppercase italic text-ink">Registro de Incidencias</h2>
                  <p className="text-xs text-[#666] font-mono uppercase tracking-widest">Historial completo de casos resueltos</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
                  <input 
                    type="text" 
                    placeholder="BUSCAR POR ORDER ID O CATEGORÍA..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-white border border-border rounded-lg pl-10 pr-4 py-2 text-[11px] font-mono w-80 outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-border shadow-sm">
                <table className="w-full border-collapse text-[12px]">
                  <thead className="sticky top-0 bg-[#F9F9F9] border-b-2 border-ink z-10">
                    <tr>
                      <th className="text-left p-4 font-serif italic uppercase tracking-widest font-bold text-[#555] text-[10px]">Order ID</th>
                      <th className="text-left p-4 font-serif italic uppercase tracking-widest font-bold text-[#555] text-[10px]">Categoría</th>
                      <th className="text-left p-4 font-serif italic uppercase tracking-widest font-bold text-[#555] text-[10px]">Sentimiento</th>
                      <th className="text-left p-4 font-serif italic uppercase tracking-widest font-bold text-[#555] text-[10px]">Resumen</th>
                      <th className="text-left p-4 font-serif italic uppercase tracking-widest font-bold text-[#555] text-[10px]">Fecha</th>
                      <th className="text-right p-4 font-serif italic uppercase tracking-widest font-bold text-[#555] text-[10px]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolvedIncidents
                      .filter(inc => 
                        inc.orderId.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        inc.category.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((inc) => (
                      <tr key={inc.id} className="border-b border-[#F0F0F0] hover:bg-ink hover:text-white transition-colors group cursor-default">
                        <td className="p-4 font-mono font-bold">{inc.orderId}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 bg-[#EEE] group-hover:bg-white/10 text-ink group-hover:text-white rounded text-[10px] font-bold uppercase transition-colors">{inc.category}</span>
                        </td>
                        <td className="p-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase transition-colors",
                            inc.sentiment === "Calmado" ? "bg-green-50 text-success group-hover:bg-success group-hover:text-white" :
                            inc.sentiment === "Frustrado" ? "bg-orange-50 text-warning group-hover:bg-warning group-hover:text-white" :
                            "bg-red-50 text-error group-hover:bg-error group-hover:text-white"
                          )}>
                            {inc.sentiment}
                          </span>
                        </td>
                        <td className="p-4 italic max-w-xs truncate opacity-70">"{inc.summary}"</td>
                        <td className="p-4 font-mono text-[10px] opacity-50">
                          {new Date(inc.createdAt!).toLocaleDateString()} {new Date(inc.createdAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => {
                              setResult(inc);
                              setIsNewTriage(false);
                              setView("triage");
                            }}
                            className="text-accent group-hover:text-white hover:underline font-bold uppercase text-[10px] transition-colors"
                          >
                            Ver Detalles
                          </button>
                        </td>
                      </tr>
                    ))}
                    {resolvedIncidents.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-20 text-center">
                          <History className="w-12 h-12 text-[#DDD] mx-auto mb-4" />
                          <div className="text-[11px] font-bold uppercase text-[#999] tracking-widest">No hay incidencias resueltas todavía</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-[#EEE] border-t border-border px-6 py-2 text-[10px] text-[#777] flex justify-between shrink-0">
        <div>Agente de Triaje Zalando v2.4.1-build.822</div>
        <div>© 2024 Zalando SE - AI Operations Division</div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
