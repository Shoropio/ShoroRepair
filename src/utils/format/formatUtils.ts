export const formatCurrency = (amount: number): string => {
    if (isNaN(amount) || amount === null) return '0,00';

    const currency = localStorage.getItem('system_currency') || 'CRC';

    const formatter = new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    return `${currency} ${formatter.format(amount)}`;
};

export const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('es-CR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};
