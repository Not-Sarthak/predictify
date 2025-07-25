import fs from "fs/promises";
import path from "path";
import Handlebars from "handlebars";
import sharp from "sharp";

interface PNLCardData {
    userProfilePhoto?: string; // Base64 or URL
    username: string;
    marketTitle: string;
    side: "YES" | "NO";
    volume: string;
    openDate: string;
    profitAmount: string;
    entryPercentage: string;
    exitPercentage: string;
    profitPercentage?: string;
    type: "positive" | "negative" | "neutral";
}

export class PNLCardGenerator {
    private templates: Map<string, HandlebarsTemplateDelegate> = new Map();
    private readonly templateDir = path.join(process.cwd(), "assets", "pnl");

    constructor() {
        this.initializeTemplates();
    }

    private async initializeTemplates() {
        try {
            // Load and compile templates
            const templates = [
                { name: "positive", file: "pnl_positive.svg" },
                { name: "negative", file: "pnl_negative.svg" },
                { name: "neutral", file: "pnl_neutral.svg" },
            ];

            for (const template of templates) {
                const templatePath = path.join(this.templateDir, template.file);
                const templateSource = await fs.readFile(templatePath, "utf8");

                // Convert SVG to use text elements instead of paths for dynamic content
                const processedTemplate = this.preprocessSVGTemplate(templateSource, template.name);
                const compiled = Handlebars.compile(processedTemplate);

                this.templates.set(template.name, compiled);
            }

            console.log("PNL card templates initialized successfully");
        } catch (error) {
            console.error("Failed to initialize PNL card templates:", error);
            throw error;
        }
    }

    private preprocessSVGTemplate(svgContent: string, templateType: string): string {
        // This function will convert the static SVG to a Handlebars template
        // We need to selectively replace only the dynamic content paths, not the static labels

        let processed = svgContent;

        if (templateType === "positive") {
            // Find and replace the market title path that comes after the comment
            const marketTitleMatch = svgContent.match(
                /<!-- Market Title -->\s*<path[^>]*d="([^"]*)"[^>]*\/>/
            );
            if (marketTitleMatch) {
                processed = processed.replace(
                    marketTitleMatch[0],
                    '<!-- Market Title -->\n<text x="86" y="231" font-family="Space Grotesk" font-size="24" fill="#FFFFFF" font-weight="500">{{marketTitle}}</text>'
                );
            }

            // Replace prediction side (YES/NO)
            const sideMatch = svgContent.match(
                /<!-- Market Side -->\s*<path[^>]*d="([^"]*)"[^>]*\/>/
            );
            if (sideMatch) {
                processed = processed.replace(
                    sideMatch[0],
                    '<!-- Market Side -->\n<text x="82" y="282" font-family="Space Grotesk" font-size="26" fill="#FFFFFF" font-weight="500">{{side}}</text>'
                );
            }

            // Replace volume value
            const volumeMatch = svgContent.match(/<!-- Volume -->\s*<path[^>]*d="([^"]*)"[^>]*\/>/);
            if (volumeMatch) {
                processed = processed.replace(
                    volumeMatch[0],
                    '<!-- Volume -->\n<text x="247" y="282" font-family="Space Grotesk" font-size="26" fill="#A1B4C5">${{volume}}</text>'
                );
            }

            // Replace date
            const dateMatch = svgContent.match(/<!-- Date -->\s*<path[^>]*d="([^"]*)"[^>]*\/>/);
            if (dateMatch) {
                processed = processed.replace(
                    dateMatch[0],
                    '<!-- Date -->\n<text x="422" y="282" font-family="Space Grotesk" font-size="26" fill="#A1B4C5">{{openDate}}</text>'
                );
            }

            // Replace profit amount
            const profitMatch = svgContent.match(
                /<!-- Profit Amount -->\s*<path[^>]*d="([^"]*)"[^>]*\/>/
            );
            if (profitMatch) {
                processed = processed.replace(
                    profitMatch[0],
                    '<!-- Profit Amount -->\n<text x="294" y="390" font-family="Space Grotesk" font-size="64" fill="#3EDB56" font-weight="700" text-anchor="middle">+${{profitAmount}}</text>'
                );
            }

            // Replace entry percentage
            const entryMatch = svgContent.match(/<!-- Entry % -->\s*<path[^>]*d="([^"]*)"[^>]*\/>/);
            if (entryMatch) {
                processed = processed.replace(
                    entryMatch[0],
                    '<!-- Entry % -->\n<text x="82" y="476" font-family="Space Grotesk" font-size="32" fill="#FFFFFF">{{entryPercentage}}%</text>'
                );
            }

            // Replace exit percentage
            const exitMatch = svgContent.match(/<!-- Exit % -->\s*<path[^>]*d="([^"]*)"[^>]*\/>/);
            if (exitMatch) {
                processed = processed.replace(
                    exitMatch[0],
                    '<!-- Exit % -->\n<text x="294" y="476" font-family="Space Grotesk" font-size="32" fill="#FFFFFF" text-anchor="middle">{{exitPercentage}}%</text>'
                );
            }

            // Replace profit percentage
            const profitPercentMatch = svgContent.match(
                /<!-- Profit % -->\s*<path[^>]*d="([^"]*)"[^>]*\/>/
            );
            if (profitPercentMatch) {
                processed = processed.replace(
                    profitPercentMatch[0],
                    '<!-- Profit % -->\n<text x="506" y="476" font-family="Space Grotesk" font-size="32" fill="#3EDB56" text-anchor="end">(+{{profitPercentage}}%)</text>'
                );
            }
        }

        if (templateType === "negative") {
            // Replace username
            const usernameMatch = svgContent.match(
                /<!-- TG USERNAME -->\s*<path[^>]*d="([^"]*)"[^>]*\/>/
            );
            if (usernameMatch) {
                processed = processed.replace(
                    usernameMatch[0],
                    '<!-- TG USERNAME -->\n<text x="120" y="81" font-family="Space Grotesk" font-size="32" fill="#FFFFFF" font-weight="500">{{username}}</text>'
                );
            }

            // Replace user image placeholder
            processed = processed.replace(
                /<rect.*?<!-- TG USER IMAGE -->.*?\/>/,
                '<image x="21" y="49" width="71" height="71" href="{{userProfilePhoto}}" clip-path="url(#circleClip)" preserveAspectRatio="xMidYMid slice"/>\n<defs><clipPath id="circleClip"><circle cx="56.5" cy="84.5" r="35.5" /></clipPath></defs>'
            );

            // Replace market title - need to be more specific
            const marketTitleNegMatch = svgContent.match(
                /<!-- MARKET TITLE TEXT -->\s*<path[^>]*d="([^"]*)"[^>]*\/>/
            );
            if (marketTitleNegMatch) {
                processed = processed.replace(
                    marketTitleNegMatch[0],
                    '<!-- MARKET TITLE TEXT -->\n<text x="86" y="210" font-family="Space Grotesk" font-size="20" fill="#FFFFFF" font-weight="500">{{marketTitle}}</text>'
                );
            }

            // Replace side (YES/NO)
            const sideNegMatch = svgContent.match(
                /<!-- SIDE - YES\/NO -->\s*<path[^>]*d="([^"]*)"[^>]*\/>/
            );
            if (sideNegMatch) {
                processed = processed.replace(
                    sideNegMatch[0],
                    '<!-- SIDE - YES/NO -->\n<text x="86" y="258" font-family="Space Grotesk" font-size="24" fill="#FFFFFF" font-weight="500">{{side}}</text>'
                );
            }

            // Replace volume number
            const volumeNegMatch = svgContent.match(
                /<!-- VOLUME NUM -->\s*<path[^>]*d="([^"]*)"[^>]*\/>/
            );
            if (volumeNegMatch) {
                processed = processed.replace(
                    volumeNegMatch[0],
                    '<!-- VOLUME NUM -->\n<text x="247" y="258" font-family="Space Grotesk" font-size="24" fill="#A1B4C5">${{volume}}</text>'
                );
            }

            // Replace date
            const dateNegMatch = svgContent.match(/<!-- DATE -->\s*<path[^>]*d="([^"]*)"[^>]*\/>/);
            if (dateNegMatch) {
                processed = processed.replace(
                    dateNegMatch[0],
                    '<!-- DATE -->\n<text x="422" y="258" font-family="Space Grotesk" font-size="24" fill="#A1B4C5">{{openDate}}</text>'
                );
            }

            // Replace PnL amount
            const pnlMatch = svgContent.match(/<!-- PnL -->\s*<path[^>]*d="([^"]*)"[^>]*\/>/);
            if (pnlMatch) {
                processed = processed.replace(
                    pnlMatch[0],
                    '<!-- PnL -->\n<text x="440" y="380" font-family="Space Grotesk" font-size="56" fill="#FF7272" font-weight="700" text-anchor="middle">-${{profitAmount}}</text>'
                );
            }

            // Replace entry number
            const entryNegMatch = svgContent.match(
                /<!-- ENTRY NUM -->\s*<path[^>]*d="([^"]*)"[^>]*\/>/
            );
            if (entryNegMatch) {
                processed = processed.replace(
                    entryNegMatch[0],
                    '<!-- ENTRY NUM -->\n<text x="130" y="494" font-family="Space Grotesk" font-size="28" fill="#FFFFFF">{{entryPercentage}}%</text>'
                );
            }

            // Replace exit number
            const exitNegMatch = svgContent.match(
                /<!-- EXIT NUM -->\s*<path[^>]*d="([^"]*)"[^>]*\/>/
            );
            if (exitNegMatch) {
                processed = processed.replace(
                    exitNegMatch[0],
                    '<!-- EXIT NUM -->\n<text x="440" y="494" font-family="Space Grotesk" font-size="28" fill="#FFFFFF" text-anchor="middle">{{exitPercentage}}%</text>'
                );
            }

            // Replace entry-exit difference
            const diffMatch = svgContent.match(
                /<!-- ENTRY - EXIT -->\s*<path[^>]*d="([^"]*)"[^>]*\/>/
            );
            if (diffMatch) {
                processed = processed.replace(
                    diffMatch[0],
                    '<!-- ENTRY - EXIT -->\n<text x="750" y="494" font-family="Space Grotesk" font-size="28" fill="#FF7272" text-anchor="end">(-{{profitPercentage}}%)</text>'
                );
            }
        }

        if (templateType === "neutral") {
            // Replace username
            const usernameNeutralMatch = svgContent.match(
                /<!-- Username -->\s*<path[^>]*d="([^"]*)"[^>]*\/>/
            );
            if (usernameNeutralMatch) {
                processed = processed.replace(
                    usernameNeutralMatch[0],
                    '<!-- Username -->\n<text x="116" y="84" font-family="Space Grotesk" font-size="40" fill="#FFFFFF" font-weight="500">{{username}}</text>'
                );
            }

            // Replace user DP
            const userDpMatch = svgContent.match(/<!-- User DP -->\s*<g[^>]*>[\s\S]*?<\/g>/);
            if (userDpMatch) {
                processed = processed.replace(
                    userDpMatch[0],
                    '<!-- User DP -->\n<image x="21" y="49" width="71" height="71" href="{{userProfilePhoto}}" clip-path="url(#circleClip)" preserveAspectRatio="xMidYMid slice"/>\n<defs><clipPath id="circleClip"><circle cx="56.5" cy="84.5" r="35.5" /></clipPath></defs>'
                );
            }

            // Replace market name
            const marketNameMatch = svgContent.match(
                /<!--Market Name-->\s*<path[^>]*d="([^"]*)"[^>]*\/>/
            );
            if (marketNameMatch) {
                processed = processed.replace(
                    marketNameMatch[0],
                    '<!--Market Name-->\n<text x="39" y="193" font-family="Space Grotesk" font-size="24" fill="#FFFFFF" font-weight="500">{{marketTitle}}</text>'
                );
            }

            // Replace market side
            const sideNeutralMatch = svgContent.match(
                /<!--Market Side \(Yes\/No\)-->\s*<path[^>]*d="([^"]*)"[^>]*\/>/
            );
            if (sideNeutralMatch) {
                processed = processed.replace(
                    sideNeutralMatch[0],
                    '<!--Market Side (Yes/No)-->\n<text x="39" y="256" font-family="Space Grotesk" font-size="26" fill="#FFFFFF" font-weight="500">{{side}}</text>'
                );
            }

            // Replace volume
            const volumeNeutralMatch = svgContent.match(
                /<!--Volume-->\s*<path[^>]*d="([^"]*)"[^>]*\/>/
            );
            if (volumeNeutralMatch) {
                processed = processed.replace(
                    volumeNeutralMatch[0],
                    '<!--Volume-->\n<text x="204" y="256" font-family="Space Grotesk" font-size="26" fill="#A1B4C5">${{volume}}</text>'
                );
            }

            // Replace date
            const dateNeutralMatch = svgContent.match(
                /<!--Date-->\s*<path[^>]*d="([^"]*)"[^>]*\/>/
            );
            if (dateNeutralMatch) {
                processed = processed.replace(
                    dateNeutralMatch[0],
                    '<!--Date-->\n<text x="378" y="256" font-family="Space Grotesk" font-size="26" fill="#A1B4C5">{{openDate}}</text>'
                );
            }

            // Replace entry %
            const entryNeutralMatch = svgContent.match(
                /<!--Entry %-->\s*<path[^>]*d="([^"]*)"[^>]*\/>/
            );
            if (entryNeutralMatch) {
                processed = processed.replace(
                    entryNeutralMatch[0],
                    '<!--Entry %-->\n<text x="137" y="364" font-family="Space Grotesk" font-size="32" fill="#FFFFFF">{{entryPercentage}}%</text>'
                );
            }

            // Replace exit %
            const exitNeutralMatch = svgContent.match(
                /<!-- Exit % -->\s*<path[^>]*d="([^"]*)"[^>]*\/>/
            );
            if (exitNeutralMatch) {
                processed = processed.replace(
                    exitNeutralMatch[0],
                    '<!-- Exit % -->\n<text x="364" y="364" font-family="Space Grotesk" font-size="32" fill="#FFFFFF">{{exitPercentage}}%</text>'
                );
            }
        }

        return processed;
    }

    public async generatePNLCard(data: PNLCardData): Promise<Buffer> {
        try {
            // Ensure templates are loaded
            if (this.templates.size === 0) {
                await this.initializeTemplates();
            }

            const template = this.templates.get(data.type);
            if (!template) {
                throw new Error(`Template ${data.type} not found`);
            }

            // Format data for template
            const formattedData = {
                ...data,
                userProfilePhoto: data.userProfilePhoto || this.getDefaultAvatar(),
            };

            // Render SVG
            const svgString = template(formattedData);

            // Convert SVG to PNG using sharp
            const pngBuffer = await sharp(Buffer.from(svgString)).png().toBuffer();

            return pngBuffer;
        } catch (error) {
            console.error("Failed to generate PNL card:", error);
            throw error;
        }
    }

    private calculateProfitPercentage(entry: string, exit: string): string {
        const entryNum = parseFloat(entry);
        const exitNum = parseFloat(exit);
        const profit = ((exitNum - entryNum) / entryNum) * 100;
        return profit.toFixed(2);
    }

    private getDefaultAvatar(): string {
        // Return a default avatar data URL
        return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzEiIGhlaWdodD0iNzEiIHZpZXdCb3g9IjAgMCA3MSA3MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzUuNSIgY3k9IjM1LjUiIHI9IjM1LjUiIGZpbGw9IiM0QTVBNkEiLz4KPHBhdGggZD0iTTM1LjUgNDJDNDAuNzQ2NyA0MiA0NSAzNy43NDY3IDQ1IDMyLjVDNDUgMjcuMjUzMyA0MC43NDY3IDIzIDM1LjUgMjNDMzAuMjUzMyAyMyAyNiAyNy4yNTMzIDI2IDMyLjVDMjYgMzcuNzQ2NyAzMC4yNTMzIDQyIDM1LjUgNDJaIiBmaWxsPSIjRkZGRkZGIi8+CjxwYXRoIGQ9Ik01NSA1NS41QzU1IDQ4LjU5NjQgNDYuMjY5MSA0MyAzNS41IDQzQzI0LjczMDkgNDMgMTYgNDguNTk2NCAxNiA1NS41IiBzdHJva2U9IiNGRkZGRkYiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+Cjwvc3ZnPg==";
    }
}

// Export singleton instance
export const pnlCardGenerator = new PNLCardGenerator();
