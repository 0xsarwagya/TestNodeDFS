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
            "/ip4/10.217.215.247/tcp/10000/p2p/12D3KooWNNHpdmm8cCpQFKeZJ182LZDJpmtuCGMCCDcocwXxvpfz"
          ).toString(),
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

  node.dial(
    multiaddr(
      "/ip4/10.217.215.247/tcp/10000/p2p/12D3KooWNNHpdmm8cCpQFKeZJ182LZDJpmtuCGMCCDcocwXxvpfz"
    )
  );

  // Schedule a task to print out the peers every 10 seconds
  cron
    .schedule("*/10 * * * * *", async () => {
      const peers = node.getPeers();
      console.log(`Connected to ${peers.length} peers`);
      peers.forEach((peer) => {
        console.log(peer.id.toB58String());
      });
    })
    .start();
};

// Ping bootnode every 30 seconds
cron
  .schedule("*/30 * * * * *", async () => {
    fetch("https://testnodedfs.onrender.com").then(() =>
      console.log("Bootnode pinged")
    );
  })
  .start();

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
