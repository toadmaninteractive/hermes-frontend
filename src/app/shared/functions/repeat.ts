export function repeat(n: number, fn: () => unknown): void {
    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < n; index++) {
        fn();
    }
}
