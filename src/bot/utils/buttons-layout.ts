export function layoutButtons<T>(buttons: T[], maxPerRow = 5): T[][] {
    const layout: T[][] = [];
    const total = buttons.length;

    if (total <= maxPerRow) {
        layout.push(buttons);
        return layout;
    }

    // Common balanced layouts for better UX
    if (total === 8 && maxPerRow >= 4) {
        layout.push(buttons.slice(0, 4), buttons.slice(4, 8));
        return layout;
    }

    if (total === 10 && maxPerRow >= 5) {
        layout.push(buttons.slice(0, 5), buttons.slice(5, 10));
        return layout;
    }

    if (total === 11 && maxPerRow >= 4) {
        layout.push(buttons.slice(0, 4), buttons.slice(4, 8), buttons.slice(8, 11));
        return layout;
    }

    for (let i = 0; i < total; i += maxPerRow) {
        layout.push(buttons.slice(i, i + maxPerRow));
    }

    return layout;
}
