# 🚀 NODEX VPN SERVER

Servidor backend para la aplicación VPN Nodex con protocolo 100% propietario.

## 🏗️ Arquitectura

```
src/
├── server.ts              # Punto de entrada principal
├── config/               # Configuraciones
├── api/                  # Endpoints REST
│   ├── auth.ts          # Autenticación
│   ├── vpn.ts           # Control VPN
│   └── users.ts         # Gestión usuarios
├── vpn/                 # Protocolo VPN Nodex
│   ├── NodexServer.ts   # Servidor VPN principal
│   ├── NodexProtocol.ts # Implementación protocolo
│   ├── NodexCrypto.ts   # Cifrado AES-256-GCM
│   └── NodexTunnel.ts   # Gestión túneles
├── firebase/            # Integración Firebase
├── utils/               # Utilidades
└── types/               # Definiciones TypeScript
```

## 🔧 Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp config.env.example .env

# Compilar TypeScript
npm run build

# Ejecutar en desarrollo
npm run dev

# Ejecutar en producción
npm start
```

## 🌐 Endpoints API

### Autenticación
- `POST /api/auth/login` - Login con Firebase
- `POST /api/auth/verify` - Verificar token JWT

### VPN Control
- `POST /api/vpn/connect` - Iniciar conexión VPN
- `POST /api/vpn/disconnect` - Terminar conexión
- `GET /api/vpn/status` - Estado de conexión
- `GET /api/vpn/stats` - Estadísticas de conexión

### Servidores
- `GET /api/servers/list` - Lista de servidores disponibles
- `POST /api/servers/test` - Probar conectividad

## 🔒 Protocolo Nodex

El servidor implementa el protocolo VPN propietario Nodex:

1. **Handshake TCP (Puerto 8443)**
   - Autenticación JWT
   - Intercambio de claves
   - Configuración del túnel

2. **Datos UDP (Puerto 8444)**
   - Tráfico del túnel cifrado
   - Keep-alive automático
   - Reconexión inteligente

## 🚀 Despliegue en VPS

```bash
# En el VPS (Ubuntu 22.04)
git clone <repo>
cd nodex-vpn-server
npm install
npm run build

# Configurar variables de entorno
nano .env

# Abrir puertos en firewall
sudo ufw allow 3000
sudo ufw allow 8443
sudo ufw allow 8444

# Ejecutar con PM2
npm install -g pm2
pm2 start dist/server.js --name "nodex-vpn"
```

## 📊 Monitoreo

- Logs: `./logs/server.log`
- Conexiones activas: `/api/vpn/status`
- Métricas: Dashboard en desarrollo

## 🔧 Desarrollo

```bash
# Modo desarrollo con hot reload
npm run dev

# Tests
npm test

# Linting
npm run lint
``` 