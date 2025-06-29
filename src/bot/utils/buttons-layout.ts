export function layoutButtons<T>(buttons: T[], maxPerRow = 4): T[][] {
    const layout: T[][] = [];

    if (buttons.length <= maxPerRow) {
        layout.push(buttons); // Single row if few buttons
    } else if (buttons.length === 8) {
        // Special case: 8 = 4 + 4
        layout.push(buttons.slice(0, 4));
        layout.push(buttons.slice(4, 8));
    } else {
        // General fallback: groups of 3
        for (let i = 0; i < buttons.length; i += 3) {
            layout.push(buttons.slice(i, i + 3));
        }
    }

    return layout;
}
