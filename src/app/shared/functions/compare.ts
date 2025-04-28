export function compare(a: number | string | Date, b: number | string | Date, isAsc: boolean) {
    if (typeof a === 'string' && typeof b === 'string') {
        return (
            a.localeCompare(b, undefined, {
                numeric: true,
                sensitivity: 'base'
            }) * (isAsc ? 1 : -1)
        );
    }

    return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}
