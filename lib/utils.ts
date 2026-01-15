export const formatDate = (date: string | Date, includeTime = false) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear().toString().slice(-2); // YY format
    // const year = d.getFullYear(); // YYYY format

    const dateStr = `${day}-${month}-${year}`;

    if (includeTime) {
        const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        return `${dateStr} ${timeStr}`; // DD-MM-YY HH:MM AM/PM
    }

    return dateStr;
};

export const formatTime = (date: string | Date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};
