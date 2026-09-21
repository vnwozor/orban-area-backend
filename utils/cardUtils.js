const BRAND_PATTERNS = [
    { brand: 'visa', pattern: /^4/ },
    { brand: 'mastercard', pattern: /^(5[1-5]|2[2-7])/ },
    { brand: 'amex', pattern: /^3[47]/ },
    { brand: 'discover', pattern: /^6(?:011|5)/ },
]

export const detectCardBrand = (digitsOnly) => {
    const match = BRAND_PATTERNS.find(({ pattern }) => pattern.test(digitsOnly))
    return match ? match.brand : 'card'
}
