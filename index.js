import { createLibp2p } from "libp2p";
import { tcp } from "@libp2p/tcp";
import { noise } from "@chainsafe/libp2p-noise";
import { mplex } from "@libp2p/mplex";
import { createFromJSON, createEd25519PeerId } from "@libp2p/peer-id-factory";
import { config } from "dotenv";
import cron from "node-cron";
import fs from "fs";
import fetch from "isomorphic-fetch";

config();

const peerIdJson = fs.existsSync(process.cwd() + "/peer-id.json")
  ? JSON.parse(fs.readFileSync(process.cwd() + "/peer-id.json"))
  : null;

const main = async () => {
  let peerId;
  if (!peerIdJson) {
    peerId = await createEd25519PeerId();
  } else {
    peerId = await createFromJSON(peerIdJson);
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
