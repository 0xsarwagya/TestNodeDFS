import { createLibp2p } from "libp2p";
import { tcp } from "@libp2p/tcp";
import { noise } from "@chainsafe/libp2p-noise";
import { mplex } from "@libp2p/mplex";
import { createFromJSON, createEd25519PeerId } from "@libp2p/peer-id-factory";
import { config } from "dotenv";
import fs from "fs";

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
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
