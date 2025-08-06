export default function PositionCard({
    bgBase,
    logoBase,
    username,
    showUsername,
    initialValue,
    pnlDiffSign,
    totalPnlDiff,
    marketData,
}: {
    bgBase: string;
    logoBase: string;
    username: string;
    showUsername: boolean;
    initialValue: string;
    pnlDiffSign: string;
    totalPnlDiff: string;
    marketData: Array<{
        title: string;
        pnl: number;
    }>;
}) {
    return (
        <div
            style={{
                display: "flex",
                width: "1280px",
                height: "720px",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Main card container */}
            <div
                style={{
                    display: "flex",
                    width: "1280px",
                    height: "720px",
                    padding: "1.5rem",
                    position: "absolute",
                    left: 0,
                    top: 0,
                    backgroundColor: "#0c0a09", // Stone-950 background
                    outlineStyle: "solid",
                    outlineWidth: "1px",
                    outlineOffset: "-1px",
                    outlineColor: "#27272a", // Neutral-800 outline
                    backdropFilter: "blur(12px)",
                    overflow: "hidden",
                }}
            >
                {/* Background pattern image */}
                <div
                    style={{
                        display: "flex",
                        position: "absolute",
                        top: 0,
                        left: 560,
                        right: 0,
                        bottom: 0,
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            width: "100%",
                            height: "100%",
                            transformOrigin: "center",
                        }}
                    >
                        <img
                            src={bgBase}
                            alt="pattern background"
                            style={{
                                width: "720px",
                                height: "100%",
                            }}
                        />
                    </div>
                </div>

                {/* Main content */}
                <div
                    style={{
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        alignItems: "flex-start",
                        gap: "3rem",
                        height: "100%",
                        width: "100%",
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            width: "100%",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        {showUsername ? (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.75rem",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        width: "4rem",
                                        height: "4rem",
                                        backgroundColor: "#1c1917",
                                        borderRadius: "9999px",
                                    }}
                                />
                                <div
                                    style={{
                                        color: "#ffffff",
                                        fontSize: "36px",
                                        fontWeight: 300,
                                        fontFamily: "'Space Grotesk', sans-serif",
                                    }}
                                >
                                    {username}
                                </div>
                            </div>
                        ) : (
                            <div style={{ width: "4rem", height: "4rem" }} />
                        )}

                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.75rem",
                            }}
                        >
                            <img src={logoBase} alt="Logo" width={40} height={40} />
                            <div
                                style={{
                                    color: "#ffffff",
                                    fontSize: "36px",
                                    fontWeight: 400,
                                    fontFamily: "'Space Grotesk', sans-serif",
                                }}
                            >
                                Predictify
                            </div>
                        </div>
                    </div>

                    {/* Main Card */}
                    <div
                        style={{
                            flex: 1,
                            width: "100%",
                            padding: "0.5rem 1.25rem",
                            backgroundColor: "rgba(23, 23, 23, 0.5)", // Neutral-900/50
                            borderRadius: "40px",
                            outlineStyle: "solid",
                            outlineWidth: "1px",
                            outlineOffset: "-1px",
                            outlineColor: "#27272a", // Neutral-800
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "flex-start",
                            alignItems: "flex-start",
                            backdropFilter: "blur(10px)",
                            border: "1px solid #27272a",
                        }}
                    >
                        {/* Total Amount Section */}
                        <div
                            style={{
                                display: "flex",
                                padding: "1.25rem",
                                paddingBottom: "1.75rem",
                                justifyContent: "flex-start",
                                alignItems: "flex-end",
                                gap: "1.25rem",
                            }}
                        >
                            <div
                                style={{
                                    color: "white",
                                    fontSize: "96px",
                                    display: "flex",
                                    fontFamily: "'Space Grotesk', sans-serif",
                                    fontWeight: "700",
                                    wordWrap: "break-word",
                                }}
                            >
                                ${initialValue}
                            </div>
                            <div
                                style={{
                                    paddingTop: "0.75rem",
                                    paddingBottom: "0.75rem",
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    gap: "0.625rem",
                                }}
                            >
                                <div
                                    style={{
                                        color: pnlDiffSign === "+" ? "#4BF06F" : "#CC3336",
                                        fontSize: "48px",
                                        fontFamily: "'Space Grotesk', sans-serif",
                                        fontWeight: "500",
                                        wordWrap: "break-word",
                                        display: "flex",
                                    }}
                                >
                                    {pnlDiffSign}${totalPnlDiff}
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div
                            style={{
                                alignSelf: "stretch",
                                borderBottom: "1px solid #27272a", // Neutral-800
                            }}
                        />

                        {/* Markets and PNL Section */}
                        <div
                            style={{
                                alignSelf: "stretch",
                                padding: "1.25rem",
                                paddingTop: "1.75rem",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                flex: 1,
                            }}
                        >
                            {/* Market Names Column */}
                            <div
                                style={{
                                    flex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "flex-start",
                                    alignItems: "flex-start",
                                    gap: "1.5rem",
                                    marginRight: "2.5rem",
                                }}
                            >
                                <div
                                    style={{
                                        color: "#78716c",
                                        fontSize: "40px",
                                        fontFamily: "'Space Grotesk', sans-serif",
                                        fontWeight: "400",
                                        textTransform: "uppercase",
                                        wordWrap: "break-word",
                                    }}
                                >
                                    Market Name
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "flex-start",
                                        alignItems: "flex-start",
                                        gap: "1.25rem",
                                    }}
                                >
                                    {marketData.map((item, idx) => (
                                        <div
                                            key={idx}
                                            style={{
                                                color: "white",
                                                fontSize: "24px",
                                                fontFamily: "'Space Grotesk', sans-serif",
                                                fontWeight: "500",
                                                wordWrap: "break-word",
                                                lineHeight: "32px",
                                                display: "flex",
                                            }}
                                        >
                                            {item.title}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* PNL Column */}
                            <div
                                style={{
                                    width: "200px",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "flex-start",
                                    alignItems: "flex-start",
                                    gap: "1.5rem",
                                }}
                            >
                                <div
                                    style={{
                                        color: "#78716c",
                                        fontSize: "40px",
                                        fontFamily: "'Space Grotesk', sans-serif",
                                        fontWeight: "400",
                                        textTransform: "uppercase",
                                        wordWrap: "break-word",
                                        textAlign: "left",
                                    }}
                                >
                                    PNL
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "flex-start",
                                        alignItems: "flex-start",
                                        gap: "1.25rem",
                                    }}
                                >
                                    {marketData.map((item, idx) => (
                                        <div
                                            key={idx}
                                            style={{
                                                color: item.pnl >= 0 ? "#4BF06F" : "#CC3336",
                                                fontSize: "24px",
                                                fontFamily: "'Space Grotesk', sans-serif",
                                                fontWeight: "500",
                                                lineHeight: "32px",
                                                display: "flex",
                                            }}
                                        >
                                            ${Math.abs(item.pnl).toFixed(2)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
