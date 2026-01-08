import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimizaciones para producción en Netlify
  // NO usar "standalone" en Netlify, el plugin maneja esto
  
  // Configuración de CSS para evitar problemas con @import
  // El plugin de Netlify maneja la optimización de CSS automáticamente
};

export default nextConfig;
