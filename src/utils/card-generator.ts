import PnlCard from "@/utils/components/PnlCard";
import PositionCard from "@/utils/components/PositionCard";
import PortfolioPositionCard from "@/utils/components/PortfolioPositionCard";
import { Resvg } from "@resvg/resvg-js";
import * as fs from "fs";
import * as fsProm from "fs/promises";
import path from "path";
import React from "react";
import satori, { type SatoriOptions } from "satori";

type PnlStatus = "Positive" | "Negative" | "Neutral";

type PredictionType = "Yes" | "No";

// Load Fonts
const fontDataRegular = fs.readFileSync(path.resolve("./assets/fonts/SpaceGrotesk-Regular.ttf"));
const fontDataBold = fs.readFileSync(path.resolve("./assets/fonts/SpaceGrotesk-Bold.ttf"));

const fontSettings: SatoriOptions = {
    width: 1280,
    height: 720,
    fonts: [
        {
            name: "Space Grotesk",
            data: fontDataRegular,
            weight: 400,
            style: "normal",
        },
        {
            name: "Space Grotesk",
            data: fontDataBold,
            weight: 700,
            style: "normal",
        },
    ],
};

// Images to Base64
const logoBuffer = await fsProm.readFile(path.resolve("./assets/logo.png"));
const logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;

const patternBufferGrey = await fsProm.readFile(path.resolve("./assets/patterns/grey.png"));
const patternBase64Grey = `data:image/png;base64,${patternBufferGrey.toString("base64")}`;

const patternBufferGreen = await fsProm.readFile(path.resolve("./assets/patterns/green.png"));
const patternBase64Green = `data:image/png;base64,${patternBufferGreen.toString("base64")}`;

const patternBufferRed = await fsProm.readFile(path.resolve("./assets/patterns/red.png"));
const patternBase64Red = `data:image/png;base64,${patternBufferRed.toString("base64")}`;

const patternBufferBlue = await fsProm.readFile(path.resolve("./assets/patterns/blue.png"));
const patternBase64Blue = `data:image/png;base64,${patternBufferBlue.toString("base64")}`;

export async function generatePnlCard(
    pnlStatus: PnlStatus,
    username: string,
    question: string,
    prediction: PredictionType,
    volume: string,
    date: string,
    pnl: number,
    entryPercentage: number,
    exitPercentage: number,
    showUsername: boolean
) {
    let backgroundImage: string = "";
    let patternToShow: string = "";

    if (pnlStatus === "Positive") {
        backgroundImage = patternBase64Green;
        patternToShow = "green";
    } else if (pnlStatus === "Negative") {
        backgroundImage = patternBase64Red;
        patternToShow = "red";
    } else if (pnlStatus === "Neutral") {
        backgroundImage = patternBase64Grey;
        patternToShow = "grey";
    }

    try {
        const svg = await satori(
            React.createElement(PnlCard, {
                backgroundImage,
                logoImage: logoBase64,
                username,
                title: question,
                prediction,
                volumeNumber: volume,
                date,
                pnlNumber: pnl,
                pnlStatus,
                entryNumber: entryPercentage,
                exitNumber: exitPercentage,
                patternToShow,
                showUsername,
            }),
            fontSettings
        );

        const resvg = new Resvg(svg);
        const pngBuffer = resvg.render().asPng();

        return pngBuffer;
    } catch (error) {
        console.error("Error generating Predictify card:", error);
        throw error;
    }
}

export async function generatePositionCard(
    username: string,
    question: string,
    prediction: string,
    volume: string,
    date: string,
    toWin: number,
    odds: number,
    size: number,
    showUsername: boolean
) {
    try {
        const svg = await satori(
            React.createElement(PositionCard, {
                backgroundImage: patternBase64Green,
                logoImage: logoBase64,
                username,
                title: question,
                prediction,
                volumeNumber: volume,
                date,
                toWin,
                odds,
                size,
                showUsername,
            } as any),
            fontSettings
        );

        const resvg = new Resvg(svg);
        const pngBuffer = resvg.render().asPng();

        return pngBuffer;
    } catch (error) {
        console.error("Error generating Predictify card:", error);
        throw error;
    }
}

export async function generatePortfolioPositionCard(
    username: string,
    showUsername: boolean,
    initialValue: string,
    pnlDiffSign: string,
    totalPnlDiff: string,
    marketData: Array<{ title: string; pnl: number }>
) {
    try {
        const svg = await satori(
            React.createElement(PortfolioPositionCard, {
                bgBase: patternBase64Blue,
                logoBase: logoBase64,
                username,
                showUsername,
                initialValue,
                pnlDiffSign,
                totalPnlDiff,
                marketData,
            }),
            fontSettings
        );

        const resvg = new Resvg(svg);
        const pngBuffer = resvg.render().asPng();

        return pngBuffer;
    } catch (error) {
        console.error("Error generating Predictify card:", error);
        throw error;
    }
}
