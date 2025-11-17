const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
console.log("Server läuft auf ws://localhost:8080");

let players = {};

wss.on('connection', ws => {
  const id = Date.now() + Math.random();
  players[id] = { x: 0, y: 0, hp: 10, class: 'krieger' };
  
  ws.send(JSON.stringify({ type: 'init', id, players }));

  ws.on('message', msg => {
    const data = JSON.parse(msg);
    if(data.type === 'update'){
      players[id] = { ...players[id], ...data.state };
      // Broadcast neue Positionen
      wss.clients.forEach(client => {
        if(client.readyState === WebSocket.OPEN){
          client.send(JSON.stringify({ type: 'players', players }));
        }
      });
    }
  });

  ws.on('close', () => { delete players[id]; });
});
