import { WebSocket } from "ws";
import { type ApiKeyCreds } from "@polymarket/clob-client";

const YES_TOKEN_ID =
    "71321045679252212594626385532706912750332728571942532289631379312455583992563";
const NO_TOKEN_ID = "52114319501245915516055106046884209969926127482827954674443846427813813222426";
const CONDITION_ID = "0x5f65177b394277fd294cd75650044e32ba009a95022d88a0c1d565897d72f8f1";

interface SubscriptionMessage {
    auth?: { apiKey: string; secret: string; passphrase: string };
    type: string;
    markets: string[];
    assets_ids: string[];
    initial_dump?: boolean;
}

interface EstablishConnectionProps {
    type: "user" | "market";
    apiKey: string;
    secret: string;
    passphrase: string;
}

export async function establishConnection({
    type,
    apiKey,
    secret,
    passphrase,
}: EstablishConnectionProps) {
    const host = "wss://ws-subscriptions-clob.polymarket.com";
    const ws = new WebSocket(`${host}/ws/${type}`);

    let subscriptionMessage: SubscriptionMessage = {} as SubscriptionMessage;

    let creds: ApiKeyCreds | undefined;
    if (type == "user") {
        creds = {
            key: apiKey,
            secret,
            passphrase,
        };
    }

    subscriptionMessage = {
        auth:
            type == "user" && creds
                ? {
                      apiKey: creds.key,
                      secret: creds.secret,
                      passphrase: creds.passphrase,
                  }
                : undefined,
        type,
        markets: [] as string[],
        assets_ids: [] as string[],
        initial_dump: true,
    };

    if (type == "user") {
        subscriptionMessage["markets"] = [CONDITION_ID];
    } else {
        subscriptionMessage["assets_ids"] = [NO_TOKEN_ID, YES_TOKEN_ID];
    }

    ws.on("error", function (err: Error) {
        console.log("Error", err);
        process.exit(1);
    });
    ws.on("close", function (code: number, reason: Buffer) {
        process.exit(1);
    });

    ws.on("open", function (ev: any) {
        ws.send(JSON.stringify(subscriptionMessage), (err?: Error) => {
            if (err) {
                console.log("Send Error", err);
                process.exit(1);
            }
        });

        setInterval(() => {
            console.log("PINGING");
            ws.send("PING");
        }, 50000);

        if (ev) {
            console.log("Open", ev);
        }
    });

    ws.onmessage = function (msg: any) {
        console.log(msg.data);
    };
}
