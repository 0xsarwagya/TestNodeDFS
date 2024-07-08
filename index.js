import { createLibp2p } from "libp2p";
import { tcp } from "@libp2p/tcp";
import { noise } from "@chainsafe/libp2p-noise";
import { mplex } from "@libp2p/mplex";
import { createFromJSON, createEd25519PeerId } from "@libp2p/peer-id-factory";
import { peerIdFromString } from "@libp2p/peer-id";
import { config } from "dotenv";
import cron from "node-cron";
import fs from "fs";
import fetch from "isomorphic-fetch";

config();

const peerIdJson = fs.existsSync(process.cwd() + "/peer-id.json")
  ? // Remove the quotes from the JSON string
    fs
      .readFileSync(process.cwd() + "/peer-id.json")
      .toString()
      .replace(/"/g, "")
  : null;

const main = async () => {
  let peerId;
  if (!peerIdJson) {
    peerId = await createEd25519PeerId();

    fs.writeFileSync(
      process.cwd() + "/peer-id.json",
      JSON.stringify({
        id: peerId.toBytes(),
        privateKey: peerId.privateKey,
        publicKey: peerId.publicKey,
      })
    );
  } else {
    peerId = createFromJSON(peerIdJson);
  }

  const node = await createLibp2p({
    peerId,
    addresses: {
      listen: [`/ip4/0.0.0.0/tcp/${process.env.PORT || 4001}`],
    },
    transports: [tcp()],
    connectionEncryption: [noise()],
    streamMuxers: [mplex()],
  });

  await node.start();
  console.log(`Bootstrap node started with id ${peerId.toString()}`);
  console.log("Listening on:");
  node.getMultiaddrs().forEach((addr) => {
    console.log(addr.toString());
  });

  // Send A PING message every 1 minute
  cron
    .schedule("*/60 * * * * *", async () => {
      const peers = await node.peerStore.all();
      console.log(`Pinging ${peers.length} peers`);
      for (const peer of peers) {
        try {
          await node.ping(peer);
          console.log(`Ping sent to ${peer.id.toString()}`);
        } catch (err) {
          console.error(`Ping failed to ${peer.id.toString()}`);
        }
      }
    })
    .start();

  // Handle incoming connections
  node.addEventListener("peer:connect", ({ peerId }) => {
    console.log(`Connected to ${peerId.toB58String()}`);
  });

  // Handle incoming connections
  node.addEventListener("peer:disconnect", ({ peerId }) => {
    console.log(`Disconnected from ${peerId.toB58String()}`);
  });

  // Handle messages
  node.handle("/ping/1.0.0", async ({ stream }) => {
    console.log("Received ping");
    stream.write({ type: "PONG" });
  });

  // Handle messages
  node.handle("/pong/1.0.0", async ({ stream }) => {
    console.log("Received pong");
  });

  // Handle messages

  node.handle("/file/1.0.0", async ({ stream }) => {
    console.log("Received file");
    stream.write({ type: "FILE" });
  });

  // Handle messages
  node.handle("/file/1.0.0", async ({ stream }) => {
    console.log("Received file");
    stream.write({ type: "FILE" });
  });
};

// Ping bootnode every 30 seconds
cron
  .schedule("*/30 * * * * *", async () => {
    fetch("https://bootnodedfs.onrender.com").then(() =>
      console.log("Bootnode pinged")
    );
  })
  .start();

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
