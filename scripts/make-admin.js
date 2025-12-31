#!/usr/bin/env node

/**
 * Script para convertir usuario en admin
 * Uso: node scripts/make-admin.js tu@email.com
 */

const email = process.argv[2];

if (!email) {
  console.log('❌ Uso: node scripts/make-admin.js <email>');
  console.log('📧 Ejemplo: node scripts/make-admin.js admin@clozen.com');
  process.exit(1);
}

console.log(`🔄 Convirtiendo ${email} en administrador...`);
console.log('');
console.log('📋 Pasos a seguir:');
console.log('');
console.log('1. Ve a https://supabase.com/dashboard');
console.log('2. Selecciona tu proyecto Clozen');
console.log('3. Ve a SQL Editor');
console.log('4. Ejecuta esta consulta:');
console.log('');
console.log(`UPDATE public.users SET role = 'admin' WHERE email = '${email}';`);
console.log('');
console.log('✅ ¡Listo! El usuario ahora tendrá permisos de administrador.');
console.log('');
console.log('🔑 Credenciales de ejemplo para admin:');
console.log(`   Email: ${email}`);
console.log('   Contraseña: (la que usaste al registrarte)');
console.log('');
console.log('🎯 Como admin podrás:');
console.log('   - Gestionar cajas físicas');
console.log('   - Escanear/escribir tags NFC');
console.log('   - Acceder a paneles administrativos');
