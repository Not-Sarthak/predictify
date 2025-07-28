export default function PnlCard({
    backgroundImage,
    logoImage,
    username,
    title,
    prediction,
    volumeNumber,
    date,
    pnlNumber,
    pnlStatus,
    entryNumber,
    exitNumber,
    patternToShow,
    showUsername,
}: {
    backgroundImage: string;
    logoImage: string;
    username: string;
    title: string;
    prediction: string;
    volumeNumber: string;
    date: string;
    pnlNumber: number;
    pnlStatus: "Positive" | "Negative" | "Neutral";
    entryNumber: number;
    exitNumber: number;
    patternToShow: string;
    showUsername: boolean;
}) {
    const { predictionWordColor, predictionBgColor } =
        prediction === "Yes"
            ? {
                  predictionWordColor: "#05df72",
                  predictionBgColor: "rgba(5, 223, 114, 0.1)",
              }
            : {
                  predictionWordColor: "#CC3336",
                  predictionBgColor: "rgba(204, 51, 54, 0.1)",
              };
    const pnlSign = pnlStatus === "Neutral" || pnlStatus === "Positive" ? "+" : "-";
    const pnlColor =
        pnlStatus === "Neutral" ? "#666666" : pnlStatus === "Positive" ? "#4BF06F" : "#CC3336";
    const diff = exitNumber - entryNumber;
    const diffColor = diff === 0 ? "#666666" : diff > 0 ? "#4BF06F" : "#CC3336";
    const diffSign = diff >= 0 ? "+" : "";
    const patternTranslate = patternToShow === "red" ? 44 : patternToShow === "green" ? 130 : 0;

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
                    padding: "1rem",
                    position: "absolute",
                    left: 0,
                    top: 0,
                    backgroundColor: "#0c0a09", // Tailwind: bg-stone-950
                    outlineStyle: "solid", // 🔑 Required to render outline
                    outlineWidth: "1px", // Tailwind: outline-1
                    outlineOffset: "-1px", // Tailwind: outline-offset-[-1px]
                    outlineColor: "#27272a", // Tailwind: outline-neutral-800
                    backdropFilter: "blur(12px)", // Tailwind: backdrop-blur-md
                    overflow: "hidden", // Tailwind: overflow-hidden
                }}
            >
                {/* Background pattern image */}
                <div
                    style={{
                        display: "flex",
                        position: "absolute",
                        top: patternTranslate,
                        left: 0,
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
                            src={backgroundImage}
                            alt="pattern background"
                            style={{
                                width: "100%",
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
                            <div style={{ width: "230px" }} />
                        )}

                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.75rem",
                            }}
                        >
                            <img src={logoImage} alt="logo" width={40} height={40} />
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

                    {/* Card */}
                    <div
                        style={{
                            width: "800px", // w-[800px]
                            flex: 1, // flex-1
                            padding: "0.5rem 1.25rem", // p-5
                            backgroundColor: "rgba(23, 23, 23, 0.5)", // bg-neutral-900/50
                            borderRadius: "40px", // rounded-[40px]
                            outlineStyle: "solid", // outline-1 (requires style!)
                            outlineWidth: "1px",
                            outlineOffset: "-1px",
                            outlineColor: "#27272a", // outline-neutral-800
                            display: "flex", // flex
                            flexDirection: "column", // flex-col
                            justifyContent: "space-between", // justify-between
                            alignItems: "flex-start", // items-start
                            border: "1px solid #27272a",
                        }}
                    >
                        {/* Question */}
                        <div
                            style={{
                                alignSelf: "stretch",
                                padding: "0.75rem 1.25rem",
                                borderRadius: "20px",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: "1.25rem",
                            }}
                        >
                            <div
                                style={{
                                    flex: 1,
                                    color: "#ffffff",
                                    fontSize: "40px",
                                    fontWeight: 400,
                                    fontFamily: "'Space Grotesk', sans-serif",
                                }}
                            >
                                {title}
                            </div>
                        </div>

                        {/* Divider */}
                        <div
                            style={{
                                alignSelf: "stretch",
                                borderBottom: "2px solid #27272a",
                                // marginTop: "1rem",
                            }}
                        ></div>

                        {/* Stats */}
                        <div
                            style={{
                                alignSelf: "stretch", // self-stretch
                                padding: "1.25rem", // p-5
                                paddingTop: "0.5rem", // pt-6
                                display: "flex",
                                flexDirection: "column", // flex-col
                                justifyContent: "flex-start",
                                alignItems: "flex-start",
                                gap: "1.5rem", // gap-12
                            }}
                        >
                            {/* Top row */}
                            <div
                                style={{
                                    width: "100%",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                }}
                            >
                                {/* Prediction */}
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "0.5rem", // match Tailwind's gap-2
                                    }}
                                >
                                    <div
                                        style={{
                                            color: "#78716c", // text-stone-500
                                            fontSize: "30px", // text-3xl
                                            fontWeight: 400,
                                            fontFamily: "'Space Grotesk', sans-serif",
                                        }}
                                    >
                                        Prediction
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.625rem", // gap-2.5
                                            padding: "0.125rem 1.5rem", // ✅ slightly reduced top/bottom padding
                                            backgroundColor: predictionBgColor,
                                            borderRadius: "0.5rem",
                                            width: "auto",
                                            alignSelf: "flex-start",
                                            lineHeight: 1,
                                        }}
                                    >
                                        <div
                                            style={{
                                                color: predictionWordColor,
                                                fontSize: "30px",
                                                fontWeight: 400,
                                                fontFamily: "'Space Grotesk', sans-serif",
                                                lineHeight: "1.3",
                                            }}
                                        >
                                            {prediction}
                                        </div>
                                    </div>
                                </div>

                                {/* Volume */}
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        // gap: "0.5rem",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            color: "#78716c",
                                            fontSize: "30px",
                                            fontWeight: 400,
                                            fontFamily: "'Space Grotesk', sans-serif",
                                        }}
                                    >
                                        Volume
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            color: "#ffffff",
                                            fontSize: "36px", // text-4xl
                                            fontWeight: 400,
                                            fontFamily: "'Space Grotesk', sans-serif",
                                        }}
                                    >
                                        ${volumeNumber}
                                    </div>
                                </div>

                                {/* Date */}
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                    }}
                                >
                                    <div
                                        style={{
                                            color: "#78716c",
                                            fontSize: "30px",
                                            fontWeight: 400,
                                            fontFamily: "'Space Grotesk', sans-serif",
                                        }}
                                    >
                                        Date
                                    </div>
                                    <div
                                        style={{
                                            color: "#ffffff",
                                            fontSize: "36px",
                                            fontWeight: 400,
                                            fontFamily: "'Space Grotesk', sans-serif",
                                        }}
                                    >
                                        {date}
                                    </div>
                                </div>
                            </div>

                            {/* PnL */}
                            <div
                                style={{
                                    display: "flex",
                                    color: pnlColor,
                                    fontSize: "96px", // text-8xl
                                    fontWeight: 700, // font-bold
                                    fontFamily: "'Space Grotesk', sans-serif",
                                }}
                            >
                                {pnlSign} ${pnlNumber.toFixed(2)}
                            </div>

                            {/* Entry & Exit */}
                            <div
                                style={{
                                    display: "flex",
                                    gap: "7rem", // gap-28
                                }}
                            >
                                {/* Entry */}
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "0.5rem", // gap-2
                                    }}
                                >
                                    <div
                                        style={{
                                            color: "#78716c", // text-stone-500
                                            fontSize: "30px", // text-3xl
                                            fontWeight: 400, // font-normal
                                            textTransform: "uppercase",
                                            fontFamily: "'Space Grotesk', sans-serif",
                                        }}
                                    >
                                        Entry
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            color: "#ffffff",
                                            fontSize: "60px", // text-6xl
                                            fontWeight: 400,
                                            fontFamily: "'Space Grotesk', sans-serif",
                                            marginTop: "-10px",
                                        }}
                                    >
                                        {entryNumber}%
                                    </div>
                                </div>

                                {/* Exit */}
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "0.5rem", // gap-2
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            color: "#78716c", // text-stone-500
                                            fontSize: "30px", // text-3xl
                                            fontWeight: 400,
                                            textTransform: "uppercase",
                                            fontFamily: "'Space Grotesk', sans-serif",
                                        }}
                                    >
                                        Exit
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "flex-end",
                                            gap: "1rem", // gap-4
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                color: "#ffffff",
                                                fontSize: "60px", // text-6xl
                                                fontWeight: 400,
                                                fontFamily: "'Space Grotesk', sans-serif",
                                                marginTop: "-10px",
                                            }}
                                        >
                                            {exitNumber}%
                                        </div>
                                        <div
                                            style={{
                                                paddingTop: "0.5rem", // py-2 = 8px top & bottom
                                                paddingBottom: "0.5rem",
                                                display: "flex",
                                                justifyContent: "center",
                                                alignItems: "center",
                                                gap: "0.625rem", // gap-2.5 = 10px
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    color: diffColor,
                                                    fontSize: "36px", // text-4xl
                                                    fontWeight: 400,
                                                    fontFamily: "'Space Grotesk', sans-serif",
                                                }}
                                            >
                                                ({diffSign}
                                                {diff.toFixed(2)}%)
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
