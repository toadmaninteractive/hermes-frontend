export function simplifyTitle(str: string): string {
    const nonCharAndDigit = new RegExp('[\\W]');
    return str
        ? str.split(nonCharAndDigit).join('-').split(new RegExp('-+')).join('-').toLowerCase()
        : '';
}
