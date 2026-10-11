// Sobe o Metro para o build de desenvolvimento do iPhone ("PhotoClass Dev").
//
// Por que existe: neste PC há um adaptador de rede extra (loopback de plugin de
// banco) que confunde a detecção de IP do Expo — ele cai em 127.0.0.1 e o
// iPhone não acha o servidor. Aqui escolhemos o IP PRIVADO da rede local e o
// passamos ao Expo. O esquema "photoclass-dev" faz o QR abrir o app Dev, não o
// da loja/TestFlight (ver app.config.js).
const os = require('os');
const { spawn } = require('child_process');

const isPrivate = (ip) =>
  /^192\.168\./.test(ip) || /^10\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);

const ip = Object.values(os.networkInterfaces())
  .flat()
  .filter((n) => n && n.family === 'IPv4' && !n.internal && isPrivate(n.address))
  .map((n) => n.address)[0];

if (!ip) {
  console.error('Não achei um IP de rede local. Conecte o PC ao Wi-Fi e tente de novo.');
  process.exit(1);
}

console.log(`Servidor de dev em http://${ip}:8081 (iPhone precisa estar no mesmo Wi-Fi)\n`);

const child = spawn('npx', ['expo', 'start', '--dev-client', '--scheme', 'photoclass-dev', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, REACT_NATIVE_PACKAGER_HOSTNAME: ip },
});
child.on('exit', (code) => process.exit(code ?? 0));
