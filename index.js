import { createLibp2p } from "libp2p";
import { tcp } from "@libp2p/tcp";
import { noise } from "@chainsafe/libp2p-noise";
import { mplex } from "@libp2p/mplex";
import { createEd25519PeerId } from "@libp2p/peer-id-factory";
import { ping } from "@libp2p/ping";
import { config } from "dotenv";
import cron from "node-cron";
import fetch from "isomorphic-fetch";
import { bootstrap } from "@libp2p/bootstrap";
import { multiaddr } from "@multiformats/multiaddr";

config();

const main = async () => {
  const peerId = await createEd25519PeerId();

  const node = await createLibp2p({
    peerId,
    addresses: {
      listen: [`/ip4/0.0.0.0/tcp/${process.env.PORT || 4001}`],
    },
    transports: [tcp()],
    connectionEncryption: [noise()],
    streamMuxers: [mplex()],
    services: {
      ping: ping({
        protocolPrefix: "rebackk",
      }),
    },
    peerDiscovery: [
      bootstrap({
        list: [
          multiaddr(
            "/ip4/10.217.215.247/tcp/10000/p2p/12D3KooWQxELdbbS1LSFEhSE6hCUHCcPVgqmSu698sD42pZSvVWi"
          ),
        ],
      }),
    ],
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
          await node.services.ping(peer.id);
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
