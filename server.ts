// Shrine of Tung — live-only chat relay for Deno Deploy.
//
// Every connected client's message is rebroadcast to all other clients.
// Nothing is stored. A BroadcastChannel fans messages across Deno Deploy's
// isolates so people who land on different instances still see each other.
//
// Deploy: point a Deno Deploy project at this file (or paste it into the
// playground). Then put the resulting URL into index.html as SHRINE_WS_URL,
// swapping https:// for wss://  e.g.  wss://<app-slug>.kanyewest50000.deno.net

import { serveDir } from "jsr:@std/http/file-server";

const sockets = new Set<WebSocket>();
const channel = new BroadcastChannel("shrine-of-tung");

function fanout(data: string, except?: WebSocket) {
  for (const s of sockets) {
    if (s !== except && s.readyState === WebSocket.OPEN) {
      try {
        s.send(data);
      } catch {
        // dead socket; it'll be cleaned up on close
      }
    }
  }
}

// messages relayed from other isolates -> send to our local sockets
channel.onmessage = (e) => fanout(e.data as string);

Deno.serve((req) => {
  // non-websocket requests: serve the static site (index.html, etc.)
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return serveDir(req, { fsRoot: ".", quiet: true });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = () => sockets.add(socket);

  socket.onmessage = (e) => {
    const data = typeof e.data === "string" ? e.data : "";
    if (!data || data.length > 4000) return; // ignore junk / oversized frames
    fanout(data, socket); // other sockets on this isolate
    channel.postMessage(data); // sockets on the other isolates
  };

  const drop = () => sockets.delete(socket);
  socket.onclose = drop;
  socket.onerror = drop;

  return response;
});
