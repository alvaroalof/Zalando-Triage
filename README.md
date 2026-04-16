# Zalando Smart Triage Agent 🚀

Sistema inteligente de triaje automatizado diseñado para departamentos de atención al cliente. Utiliza Inteligencia Artificial (Google Gemini) para transformar correos electrónicos no estructurados en datos accionables en tiempo real.

## 📋 Descripción del Proyecto

Este agente actúa como la primera línea de defensa en el soporte técnico de Zalando. Analiza el contenido de los correos entrantes para extraer información crítica, permitiendo a los agentes humanos priorizar y resolver casos con una eficiencia significativamente mayor.

## ✨ Características Principales

- **Análisis de Sentimiento**: Detecta automáticamente si el cliente está calmado, frustrado o si el caso es urgente.
- **Extracción de Datos Estructurados**: Identifica automáticamente el `Order ID` (ZA-XXXX) y clasifica la incidencia en categorías predefinidas.
- **Cola de Trabajo en Tiempo Real**: Sincronización instantánea con Firebase para gestionar incidencias pendientes y resueltas.
- **Dashboard de Alta Densidad**: Interfaz diseñada para operaciones rápidas, con visualización de JSON raw para integración técnica.
- **Seguridad Robusta**: Reglas de Firestore configuradas para proteger los datos y autenticación mediante Google.

## 🛠️ Stack Tecnológico

- **Frontend**: React 18 + TypeScript.
- **Estilos**: Tailwind CSS (Diseño técnico de alta densidad).
- **IA**: Google Gemini 1.5 Flash (vía @google/genai).
- **Backend/Base de Datos**: Firebase (Firestore + Auth).
- **Animaciones**: Framer Motion.
- **Iconos**: Lucide React.

## 🚀 Configuración y Despliegue

### Requisitos Previos
- Node.js (v18 o superior)
- Una cuenta en Google AI Studio (para la API Key de Gemini)
- Un proyecto en Firebase

### Pasos para Instalación Local

1. **Clonar el repositorio**:
   ```bash
   git clone <url-del-repositorio>
   cd zalando-triage-agent
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Configurar Firebase**:
   - Localiza el archivo `firebase-applet-config.json.example`.
   - Renómbralo a `firebase-applet-config.json`.
   - Introduce las credenciales de tu proyecto Firebase.

4. **Configurar Variables de Entorno**:
   - Crea un archivo `.env`.
   - Añade tu clave de API: `GEMINI_API_KEY=tu_clave_aqui`.

5. **Lanzar en desarrollo**:
   ```bash
   npm run dev
   ```

## 🔒 Seguridad (Importante)

Este proyecto está configurado para ser **seguro para GitHub**:
- Las claves de Firebase (`firebase-applet-config.json`) están en el `.gitignore`.
- La API Key de Gemini se maneja mediante variables de entorno.
- Las reglas de Firestore en `firestore.rules` impiden el acceso no autorizado.

---
*Desarrollado para la División de Operaciones de IA - Zalando SE*
