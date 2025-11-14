import React, { useState, useMemo, useEffect, useRef } from 'react';

// --- TYPE DEFINITIONS & CONSTANTS ---
declare var html2canvas: any;
declare var jspdf: any;

// For Google Identity Services
declare global {
    interface Window {
        google: any;
    }
}


type ActiveTab = 'counter' | 'billing' | 'gst';
type Theme = 'light' | 'dark';

const CURRENCY_DATA = [
    { id: 'note-500', value: 500, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/India_new_500_INR%2C_Mahatma_Gandhi_New_Series%2C_2016%2C_obverse.png/320px-India_new_500_INR%2C_Mahatma_Gandhi_New_Series%2C_2016%2C_obverse.png' },
    { id: 'note-200', value: 200, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/India_new_200_INR%2C_Mahatma_Gandhi_New_Series%2C_2017%2C_obverse.png/320px-India_new_200_INR%2C_Mahatma_Gandhi_New_Series%2C_2017%2C_obverse.png' },
    { id: 'note-100', value: 100, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/India_new_100_INR%2C_Mahatma_Gandhi_New_Series%2C_2018%2C_obverse.png/320px-India_new_100_INR%2C_Mahatma_Gandhi_New_Series%2C_2018%2C_obverse.png' },
    { id: 'note-50', value: 50, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/India_new_50_INR%2C_Mahatma_Gandhi_New_Series%2C_2017%2C_obverse.png/320px-India_new_50_INR%2C_Mahatma_Gandhi_New_Series%2C_2017%2C_obverse.png' },
    { id: 'note-20', value: 20, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/India_new_20_INR%2C_Mahatma_Gandhi_New_Series%2C_2019%2C_obverse.png/320px-India_new_20_INR%2C_Mahatma_Gandhi_New_Series%2C_2019%2C_obverse.png' },
    { id: 'note-10', value: 10, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/India_new_10_INR%2C_Mahatma_Gandhi_New_Series%2C_2018%2C_obverse.png/320px-India_new_10_INR%2C_Mahatma_Gandhi_New_Series%2C_2018%2C_obverse.png' },
    { id: 'note-5', value: 5, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/India_5_INR%2C_MG_series%2C_2002%2C_obverse.png/320px-India_5_INR%2C_MG_series%2C_2002%2C_obverse.png'},
];


// --- CUSTOM HOOK FOR LOCAL STORAGE ---
function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(error);
        }
    };

    return [storedValue, setValue];
}

// --- HELPER FUNCTIONS ---
const numberToWordsIn = (num: number): string => {
    if (num === 0) return 'Zero';
    if (num > 999999999) return "Number too large";
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const convertLessThanThousand = (n: number): string => {
        let result = '';
        if (n >= 100) { result += ones[Math.floor(n / 100)] + ' Hundred '; n %= 100; }
        if (n >= 20) { result += tens[Math.floor(n / 10)] + ' '; n %= 10; }
        if (n >= 10) { return result + teens[n - 10]; }
        if (n > 0) { result += ones[n]; }
        return result.trim();
    };
    let result = '';
    const crore = Math.floor(num / 10000000); num %= 10000000;
    const lakh = Math.floor(num / 100000); num %= 100000;
    const thousand = Math.floor(num / 1000); num %= 1000;
    if (crore) result += convertLessThanThousand(crore) + ' Crore ';
    if (lakh) result += convertLessThanThousand(lakh) + ' Lakh ';
    if (thousand) result += convertLessThanThousand(thousand) + ' Thousand ';
    result += convertLessThanThousand(num);
    return result.trim().replace(/\s+/g, ' ');
};

const addWatermark = (doc: any) => {
    const totalPages = doc.internal.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(40);
        doc.setTextColor(230, 230, 230); // Light gray
        doc.setFont(undefined, 'bold');
        
        doc.text(
            ["App developed in India", "Developed by Virus 2.0"],
            pageWidth / 2,
            pageHeight / 2,
            { align: 'center', angle: -45, baseline: 'middle' }
        );
    }
    // Reset text color for any other operations
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
};


// --- UI ICONS ---
const CounterIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 14h.01M12 11h.01M15 11h.01M9 11h.01M12 21a9 9 0 110-18 9 9 0 010 18z" /></svg>;
const BillingIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
const GstIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
const LogoutIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const CloseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const MenuIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>;
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const ThemeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const FeedbackIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
const GoogleIcon = () => <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.222 0-9.618-3.226-11.283-7.582l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C44.592 34.933 48 29.861 48 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;

// =====================================================================================
// --- SPLASH SCREEN COMPONENT ---
// =====================================================================================
const SplashScreen: React.FC = () => (
    <div className="fixed inset-0 bg-slate-100 dark:bg-gray-900 z-[100] flex flex-col items-center justify-center splash-screen">
        <div className="splash-content text-center">
            <div className="relative w-[150px] h-[100px] mb-6 inline-block overflow-hidden rounded-md shadow-lg">
                <div className="absolute top-0 left-0 w-full h-1/3 bg-[#FF9933] animate-slide-in-saffron"></div>
                <div className="absolute top-1/3 left-0 w-full h-1/3 bg-white animate-slide-in-white flex items-center justify-center">
                     <svg width="33" height="33" viewBox="0 0 100 100" className="animate-chakra-spin">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#000080" strokeWidth="8"/>
                        <g transform="translate(50,50)">
                            {[...Array(24)].map((_, i) => (
                                <line key={i} x1="0" y1="0" x2="0" y2="-45" stroke="#000080" strokeWidth="4" transform={`rotate(${i * 15})`}/>
                            ))}
                        </g>
                        <circle cx="50" cy="50" r="10" fill="#000080"/>
                    </svg>
                </div>
                <div className="absolute bottom-0 left-0 w-full h-1/3 bg-[#138808] animate-slide-in-green"></div>
            </div>
            <p className="text-2xl font-bold text-slate-700 dark:text-slate-300 tracking-wider">
                Proudly Created in India
            </p>
        </div>
    </div>
);


// =====================================================================================
// --- CASH COUNTER COMPONENT ---
// =====================================================================================
const CashCounter: React.FC<{ userName: string }> = ({ userName }) => {
    const [counts, setCounts] = useLocalStorage<{ [key: string]: string }>('cashCounterCounts', {});
    const [history, setHistory] = useLocalStorage<any[]>('cashCounterHistory', []);
    const [showHistory, setShowHistory] = useState(false);
    const [expectedAmount, setExpectedAmount] = useLocalStorage('expectedAmount', '');
    const [isSummaryOpen, setIsSummaryOpen] = useState(false);
    const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

    const handleCountChange = (id: string, newCount: string) => {
        if (/^\d*$/.test(newCount)) {
            setCounts(prev => ({ ...prev, [id]: newCount }));
        }
    };
    
    const { totalAmount, totalNotes } = useMemo(() => {
        return CURRENCY_DATA.reduce((acc, denom) => {
            const count = parseInt(counts[denom.id] || '0', 10);
            if (count > 0) {
                acc.totalAmount += denom.value * count;
                acc.totalNotes += count;
            }
            return acc;
        }, { totalAmount: 0, totalNotes: 0 });
    }, [counts]);

    const difference = useMemo(() => {
        const expected = parseFloat(expectedAmount) || 0;
        if (expected === 0) return null;
        return totalAmount - expected;
    }, [totalAmount, expectedAmount]);

    const handleClear = () => { setCounts({}); setExpectedAmount(''); }
    const handleSave = () => {
        if (totalAmount > 0) {
            const newEntry = {
                date: new Date().toISOString(),
                totalAmount, totalNotes, counts, expectedAmount,
            };
            setHistory([newEntry, ...history]);
            alert('Count saved to history!');
        }
    };
    
    const generateShareText = () => {
        const now = new Date();
        const formattedDateTime = now.toLocaleString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        let text = `*Cash Count Summary*\n\n`;
        text += `*Total Amount: ₹${totalAmount.toLocaleString('en-IN')}*\n\n`;
        
        CURRENCY_DATA.forEach(denom => {
            const count = parseInt(counts[denom.id] || '0', 10);
            if (count > 0) {
                text += `₹${denom.value} × ${count} = ₹${(denom.value * count).toLocaleString('en-IN')}\n`;
            }
        });
        
        text += `\n*Total Notes:* ${totalNotes}\n\n`;
        text += `--------------------\n`;
        text += `Shared by: ${userName}\n`;
        text += `On: ${formattedDateTime}`;
        return text;
    };

    const handleShare = () => {
        if (totalAmount <= 0) return;

        const shareText = generateShareText();
        
        if (navigator.share) {
            navigator.share({
                title: 'Cash Count Summary',
                text: shareText,
            }).catch(error => console.error('Error sharing:', error));
        } else {
            // Fallback for browsers that don't support the Web Share API
            window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
        }
    };
    
    const generateSingleEntryPdf = (entry: any) => {
        const { jsPDF } = jspdf;
        const doc = new jsPDF();
        doc.text(`Cash Count Summary`, 105, 15, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Date: ${new Date(entry.date).toLocaleString('en-IN')}`, 14, 25);
        doc.setFontSize(10);
        doc.text(`Generated By: ${userName}`, 196, 25, { align: 'right' });

        doc.setFontSize(10);
        doc.text(`Total Amount: ₹${(entry.totalAmount || 0).toLocaleString('en-IN')}`, 14, 35);
        if (entry.expectedAmount) {
            const expected = parseFloat(entry.expectedAmount);
            const difference = entry.totalAmount - expected;
            doc.text(`Expected Amount: ₹${expected.toLocaleString('en-IN')}`, 14, 40);
            doc.text(`Difference: ₹${difference.toLocaleString('en-IN')} (${difference > 0 ? 'Extra' : difference < 0 ? 'Short' : 'Matched'})`, 14, 45);
        }
        doc.text(`Total Notes: ${entry.totalNotes}`, 14, 50);

        const tableColumn = ["Denomination", "Count", "Amount"];
        const tableRows: any[] = [];
        CURRENCY_DATA.forEach(denom => {
            const count = parseInt(entry.counts[denom.id] || '0', 10);
            if (count > 0) {
                tableRows.push([
                    `₹ ${denom.value}`,
                    count.toLocaleString('en-IN'),
                    `₹ ${(denom.value * count).toLocaleString('en-IN')}`
                ]);
            }
        });
        doc.autoTable({ head: [tableColumn], body: tableRows, startY: 60, theme: 'grid' });
        addWatermark(doc);
        doc.save(`cash_summary_${new Date(entry.date).toISOString().split('T')[0]}.pdf`);
    };

    const generateHistoryPdf = () => {
        const { jsPDF } = jspdf;
        const doc = new jsPDF();
        let yPos = 15;
        doc.text("Cash Counter History", 105, yPos, { align: 'center' });
        yPos += 7;
        doc.setFontSize(10);
        doc.text(`Report for: ${userName}`, 105, yPos, { align: 'center' });
        yPos += 10;

        history.forEach((entry, index) => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 15;
            }
            doc.setFontSize(12);
            doc.text(`Entry #${index + 1}: ${new Date(entry.date).toLocaleString('en-IN')}`, 14, yPos);
            yPos += 7;
            doc.setFontSize(10);
            doc.text(`Total Amount: ₹${(entry.totalAmount || 0).toLocaleString('en-IN')}`, 14, yPos);
            yPos += 5;
            doc.text(`Total Notes: ${entry.totalNotes}`, 14, yPos);
            yPos += 7;
            const tableColumn = ["Denomination", "Count", "Amount"];
            const tableRows: any[] = [];
            CURRENCY_DATA.forEach(denom => {
                const count = parseInt(entry.counts[denom.id] || '0', 10);
                if (count > 0) {
                    tableRows.push([
                        `₹ ${denom.value}`,
                        count.toLocaleString('en-IN'),
                        `₹ ${(denom.value * count).toLocaleString('en-IN')}`
                    ]);
                }
            });
            doc.autoTable({
                head: [tableColumn], body: tableRows, startY: yPos,
                theme: 'striped', headStyles: { fillColor: [88, 80, 236] }, margin: { left: 14 }
            });
            yPos = (doc as any).autoTable.previous.finalY + 15;
        });
        addWatermark(doc);
        doc.save("cash_history_full.pdf");
    };
    
    return (
        <div className="flex-grow container mx-auto p-2 sm:p-4 pb-24">
            {showHistory ? (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Counter History</h2>
                        <div className="flex gap-2">
                             <button onClick={generateHistoryPdf} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm sm:text-base">Export All PDF</button>
                             <button onClick={() => setShowHistory(false)} className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm sm:text-base">Back to Counter</button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {history.length > 0 ? history.map(h => (
                            <div key={h.date} className="bg-white dark:bg-slate-800 rounded-lg shadow-md overflow-hidden transition-all">
                                <div className="p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700" onClick={() => setExpandedHistory(expandedHistory === h.date ? null : h.date)}>
                                    <div>
                                        <p className="font-semibold">{new Date(h.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                        <p className="text-slate-600 dark:text-slate-300">Total: <span className="font-bold text-violet-600 dark:text-violet-400">₹{(h.totalAmount || 0).toLocaleString('en-IN')}</span></p>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${expandedHistory === h.date ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </div>
                                {expandedHistory === h.date && (
                                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-3 bg-slate-50 dark:bg-slate-800/50">
                                        <div className="grid grid-cols-3 gap-2 text-sm text-center">
                                             {CURRENCY_DATA.map(denom => {
                                                const count = parseInt(h.counts[denom.id] || '0', 10);
                                                return count > 0 ? <div key={denom.id} className="bg-slate-200 dark:bg-slate-700 p-1 rounded">₹{denom.value} &times; {count}</div> : null;
                                            })}
                                        </div>
                                        <button onClick={() => generateSingleEntryPdf(h)} className="w-full flex items-center justify-center gap-2 mt-2 px-4 py-2 bg-violet-600 text-white rounded-lg font-semibold hover:bg-violet-700">
                                            <DownloadIcon />
                                            Download PDF
                                        </button>
                                    </div>
                                )}
                            </div>
                        )) : <p className="text-center text-slate-500 mt-8">No history yet. Perform a count and save it!</p>}
                    </div>
                </div>
            ) : (
                <>
                    <div className="mb-4">
                        <label htmlFor="expectedAmount" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Expected Total Amount</label>
                        <div className="mt-1 flex items-center gap-2">
                            <input
                                id="expectedAmount"
                                type="number"
                                value={expectedAmount}
                                onChange={e => setExpectedAmount(e.target.value)}
                                placeholder="e.g., 50000"
                                className="w-full text-xl rounded-lg p-2 bg-slate-100 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-violet-500"
                            />
                            {difference !== null && difference !== 0 && (
                                <div className={`px-3 py-2 rounded-lg text-white font-bold whitespace-nowrap ${difference < 0 ? 'bg-red-500' : 'bg-green-500'}`}>
                                    {difference > 0 ? 'Extra' : 'Short'}: ₹{Math.abs(difference).toLocaleString('en-IN')}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
                        {/* Notes Section */}
                        <div className="divide-y divide-slate-200 dark:divide-slate-700">
                            {CURRENCY_DATA.map(denom => (
                                <div key={denom.id} className="grid grid-cols-12 gap-2 items-center px-4 py-2">
                                    <div className="col-span-4 flex items-center gap-3">
                                        <img src={denom.imageUrl} alt={`₹ ${denom.value}`} className="object-contain w-24 h-12"/>
                                        <span className="font-semibold text-slate-700 dark:text-slate-200">{denom.type}</span>
                                    </div>
                                    <div className="col-span-3 flex items-center justify-center gap-2">
                                        <span className="text-xl font-medium text-slate-500 dark:text-slate-400">×</span>
                                        <input type="text" inputMode="numeric" pattern="\d*" value={counts[denom.id] || ''} onChange={(e) => handleCountChange(denom.id, e.target.value)} placeholder="0" className="w-full text-center text-xl font-bold rounded-lg p-2 bg-slate-100 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-violet-500"/>
                                    </div>
                                    <div className="col-span-5 text-right text-lg font-semibold text-violet-600 dark:text-violet-400 truncate">
                                        ₹{(denom.value * (parseInt(counts[denom.id] || '0', 10))).toLocaleString('en-IN')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* Floating Action Button for Summary */}
            {!showHistory && totalAmount > 0 && (
                <button
                    onClick={() => setIsSummaryOpen(true)}
                    className="fixed bottom-20 right-4 bg-gradient-to-r from-purple-600 to-violet-700 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all z-20 flex items-center gap-2"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <span>Total: ₹{totalAmount.toLocaleString('en-IN')}</span>
                </button>
            )}

            {/* Summary Popup / Bottom Sheet */}
            <div 
                className={`fixed inset-0 z-40 transition-opacity ${isSummaryOpen ? 'bg-black/60' : 'bg-transparent pointer-events-none'}`}
                onClick={() => setIsSummaryOpen(false)}
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 shadow-t-2xl p-4 transition-transform duration-300 ease-in-out transform rounded-t-2xl ${isSummaryOpen ? 'translate-y-0' : 'translate-y-full'} z-50`}
                >
                    <div className="max-w-4xl mx-auto space-y-3">
                         {/* Popup Header */}
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
                             <h2 className="text-lg font-bold">Calculation Summary</h2>
                             <button onClick={() => setIsSummaryOpen(false)} className="p-1 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700">
                                 <CloseIcon />
                             </button>
                        </div>
                        
                        {/* Popup Content */}
                         <div className="flex justify-between items-center">
                            <div className="text-left">
                                <h2 className="text-sm font-bold text-violet-600 dark:text-violet-400">GRAND TOTAL</h2>
                                <p className="text-3xl font-extrabold tracking-tight">₹{totalAmount.toLocaleString('en-IN')}</p>
                            </div>
                            {difference !== null && (
                                <div className={`text-right p-2 rounded-lg ${difference < 0 ? 'bg-red-100 dark:bg-red-900' : 'bg-green-100 dark:bg-green-900'}`}>
                                    <h2 className={`text-sm font-bold ${difference < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                        {difference === 0 ? 'MATCHED' : difference > 0 ? 'EXTRA' : 'SHORT'}
                                    </h2>
                                    <p className="text-xl font-bold">₹{Math.abs(difference).toLocaleString('en-IN')}</p>
                                </div>
                            )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 italic h-4">
                            {totalAmount > 0 && `${numberToWordsIn(Math.floor(totalAmount))} Rupees Only`}
                        </div>
                         <div className="flex justify-around items-center border-t border-slate-200 dark:border-slate-700 pt-2">
                            <div className="text-center"><p className="text-sm">Total Notes</p><p className="font-bold text-lg">{totalNotes}</p></div>
                            <div className="text-center"><button onClick={() => { setIsSummaryOpen(false); setShowHistory(true); }} className="text-sm text-violet-600 dark:text-violet-400 hover:underline">View History ({history.length})</button></div>
                        </div>
                         <div className="flex justify-center gap-2 pt-2">
                                <button onClick={handleClear} className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-600 rounded-lg font-semibold">Clear</button>
                                <button onClick={handleSave} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold">Save</button>
                                <button onClick={handleShare} className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold">Share</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// =====================================================================================
// --- BILLING COMPONENT ---
// =====================================================================================
interface BillItem { id: number; name: string; qty: number; price: number; }

const Billing: React.FC<{ userName: string }> = ({ userName }) => {
    const [items, setItems] = useLocalStorage<BillItem[]>('billItems', [{ id: 1, name: '', qty: 1, price: 0 }]);
    const [customerName, setCustomerName] = useLocalStorage('billCustomer', '');

    const handleItemChange = (id: number, field: keyof BillItem, value: any) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const addItem = () => setItems([...items, { id: Date.now(), name: '', qty: 1, price: 0 }]);
    const removeItem = (id: number) => setItems(items.filter(item => item.id !== id));
    const clearBill = () => { setItems([{ id: 1, name: '', qty: 1, price: 0 }]); setCustomerName(''); };

    const totalBill = useMemo(() => items.reduce((sum, item) => sum + (item.qty * item.price), 0), [items]);

    const generatePdf = () => {
        const { jsPDF } = jspdf;
        const doc = new jsPDF();
        doc.text("Invoice", 105, 15, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Customer: ${customerName || 'N/A'}`, 14, 25);
        doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 14, 32);
        doc.setFontSize(10);
        doc.text(`Generated By: ${userName}`, 196, 25, { align: 'right' });

        doc.autoTable({
            startY: 40,
            head: [['Item Name', 'Quantity', 'Price', 'Total']],
            body: items.map(item => [item.name, item.qty, `₹${item.price.toFixed(2)}`, `₹${(item.qty * item.price).toFixed(2)}`]),
            foot: [['', '', 'Grand Total', `₹${totalBill.toFixed(2)}`]],
            theme: 'grid',
        });
        addWatermark(doc);
        doc.save(`invoice-${Date.now()}.pdf`);
    };

    return (
        <div className="flex-grow container mx-auto p-2 sm:p-4 pb-32">
            <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Customer Name (Optional)"
                className="w-full p-3 mb-4 rounded-lg border bg-white dark:bg-slate-700 dark:border-slate-600"
            />
            <div className="space-y-3">
                {items.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-white dark:bg-slate-800 p-2 rounded-lg">
                        <input type="text" value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} placeholder="Item Name" className="col-span-5 p-2 rounded border bg-white dark:bg-slate-700 dark:border-slate-600" />
                        <input type="number" value={item.qty} onChange={e => handleItemChange(item.id, 'qty', parseFloat(e.target.value) || 0)} placeholder="Qty" className="col-span-2 p-2 rounded border bg-white dark:bg-slate-700 dark:border-slate-600 text-center" />
                        <input type="number" value={item.price || ''} onChange={e => handleItemChange(item.id, 'price', parseFloat(e.target.value) || 0)} placeholder="Price" className="col-span-3 p-2 rounded border bg-white dark:bg-slate-700 dark:border-slate-600 text-center" />
                        <button onClick={() => removeItem(item.id)} disabled={items.length <= 1} className="col-span-2 text-red-500 disabled:opacity-50 flex justify-center items-center"><TrashIcon /></button>
                    </div>
                ))}
            </div>
            <button onClick={addItem} className="mt-4 w-full py-2 bg-blue-600 text-white rounded-lg">Add Item</button>

            <footer className="fixed bottom-16 left-0 right-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700 p-3">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-center">
                        <p className="text-xl font-bold">Total: ₹{totalBill.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        <div className="flex gap-2">
                            <button onClick={clearBill} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg">Clear</button>
                            <button onClick={generatePdf} className="px-4 py-2 bg-green-600 text-white rounded-lg">Create PDF</button>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

// =====================================================================================
// --- GST CALCULATOR COMPONENT ---
// =====================================================================================
interface GstHistoryItem { id: number; amount: number; rate: number; type: 'add' | 'remove'; result: any; }
const GST_RATES = [3, 5, 12, 18, 28];

const GstCalculator: React.FC = () => {
    const [amount, setAmount] = useState<string>('');
    const [rate, setRate] = useState<number>(18);
    const [type, setType] = useState<'add' | 'remove'>('add');
    const [history, setHistory] = useLocalStorage<GstHistoryItem[]>('gstHistory', []);

    const result = useMemo(() => {
        const numAmount = parseFloat(amount) || 0;
        if (numAmount === 0) return null;

        let gstAmount, finalAmount;
        if (type === 'add') {
            gstAmount = numAmount * (rate / 100);
            finalAmount = numAmount + gstAmount;
        } else {
            gstAmount = numAmount - (numAmount * (100 / (100 + rate)));
            finalAmount = numAmount - gstAmount;
        }
        return { initial: numAmount, gst: gstAmount, final: type === 'add' ? finalAmount : finalAmount, cgst: gstAmount/2, sgst: gstAmount/2 };
    }, [amount, rate, type]);
    
    const handleSave = () => {
        if(result) {
            setHistory([{ id: Date.now(), amount: result.initial, rate, type, result }, ...history]);
        }
    }

    return (
        <div className="flex-grow container mx-auto p-2 sm:p-4 pb-32">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-lg space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Amount (₹)</label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-3 text-2xl rounded-lg border dark:bg-slate-700 dark:border-slate-600" placeholder="0.00" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">GST Rate (%)</label>
                    <div className="flex gap-2 flex-wrap">
                        {GST_RATES.map(r => <button key={r} onClick={() => setRate(r)} className={`px-4 py-2 rounded-lg ${rate === r ? 'bg-violet-600 text-white' : 'bg-slate-200 dark:bg-slate-600'}`}>{r}%</button>)}
                    </div>
                </div>
                <div>
                     <div className="flex gap-4">
                        <label className="flex items-center"><input type="radio" name="gstType" checked={type === 'add'} onChange={() => setType('add')} className="mr-2" />Add GST</label>
                        <label className="flex items-center"><input type="radio" name="gstType" checked={type === 'remove'} onChange={() => setType('remove')} className="mr-2" />Remove GST</label>
                    </div>
                </div>
                {result && (
                    <div className="border-t pt-4 space-y-2">
                        <div className="flex justify-between"><span className="text-slate-500">Initial Amount:</span> <span>₹{result.initial.toLocaleString('en-IN')}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">CGST ({rate/2}%):</span> <span>₹{result.cgst.toLocaleString('en-IN')}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">SGST ({rate/2}%):</span> <span>₹{result.sgst.toLocaleString('en-IN')}</span></div>
                        <div className="flex justify-between text-xl font-bold"><span className="">Final Amount:</span> <span className="text-violet-600">₹{result.final.toLocaleString('en-IN')}</span></div>
                        <button onClick={handleSave} className="w-full mt-2 py-2 bg-blue-600 text-white rounded-lg">Save Calculation</button>
                    </div>
                )}
            </div>
             <div className="mt-6">
                <h3 className="text-lg font-bold mb-2">History</h3>
                <div className="space-y-2">
                {history.map(h => (
                    <div key={h.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm text-sm">
                        <p>Initial: ₹{(h.amount || 0).toLocaleString('en-IN')} @ {h.rate}% ({h.type})</p>
                        <p className="font-semibold">Final: ₹{(h.result?.final ?? 0).toLocaleString('en-IN')}</p>
                    </div>
                ))}
                </div>
            </div>
        </div>
    );
};

// =====================================================================================
// --- LOGIN SCREEN COMPONENT ---
// =====================================================================================
// Helper to decode JWT token from Google Sign-In
const jwt_decode = (token: string) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Error decoding JWT", e);
        return null;
    }
};

const LoginScreen: React.FC<{ onLogin: (name: string) => void }> = ({ onLogin }) => {
    const [name, setName] = useState('');
    const [error, setError] = useState('');

    const handleNameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onLogin(name.trim());
        }
    };
    
    // Google Sign-In Callback
    const handleGoogleSignInCallback = (response: any) => {
        // NOTE: In a real-world app, you should send the credential to your backend for verification.
        const userObject = jwt_decode(response.credential);
        if (userObject && userObject.name) {
            onLogin(userObject.name);
        } else {
             setError("Could not retrieve name from Google account.");
        }
    };

    useEffect(() => {
        // Initialize Google Sign-In
        if (window.google) {
            window.google.accounts.id.initialize({
                // IMPORTANT: Replace with your actual Google Client ID
                client_id: "307413483347-jviu5aqulsnob10ppof817pn309eep8o.apps.googleusercontent.com",
                callback: handleGoogleSignInCallback
            });

            window.google.accounts.id.renderButton(
                document.getElementById("googleSignInButton"),
                { theme: "outline", size: "large", type: 'standard', text: 'signin_with', shape: 'rectangular' } 
            );
        } else {
            console.error("Google Identity Services script not loaded.");
        }
    }, []);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-gray-900 p-4">
            <div className="w-full max-w-sm mx-auto bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl">
                <h1 className="text-3xl font-bold text-center mb-2 text-violet-600 dark:text-violet-400">Welcome</h1>
                <p className="text-center text-slate-500 mb-6">Choose an option to continue.</p>
                
                {/* --- Login with Name --- */}
                <form onSubmit={handleNameSubmit} className="space-y-4">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter Your Name"
                        className="w-full px-4 py-3 text-lg rounded-lg border-2 border-slate-300 dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                    />
                    <button type="submit" className="w-full py-3 bg-gradient-to-r from-purple-600 to-violet-700 text-white font-bold rounded-lg text-lg">
                        Continue with Name
                    </button>
                </form>

                {/* --- OR Divider --- */}
                <div className="flex items-center my-6">
                    <div className="flex-grow border-t border-slate-300 dark:border-slate-600"></div>
                    <span className="mx-4 text-slate-500">OR</span>
                    <div className="flex-grow border-t border-slate-300 dark:border-slate-600"></div>
                </div>
                
                {/* --- Google Login --- */}
                <div className="space-y-2">
                     <div id="googleSignInButton" className="flex justify-center"></div>
                     {error && <p className="text-red-500 text-sm text-center pt-2">{error}</p>}
                </div>
            </div>
        </div>
    );
};


// =====================================================================================
// --- FEEDBACK MODAL COMPONENT ---
// =====================================================================================
const FeedbackModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [feedback, setFeedback] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (feedback.trim()) {
            alert("Thank you for your feedback!");
            onClose();
        } else {
            alert("Please enter your feedback before submitting.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold">Submit Feedback</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><CloseIcon /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <textarea
                        value={feedback}
                        onChange={e => setFeedback(e.target.value)}
                        placeholder="Tell us what you think..."
                        className="w-full h-32 p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
                        autoFocus
                    ></textarea>
                    <button type="submit" className="w-full py-2 bg-violet-600 text-white font-semibold rounded-lg">Submit</button>
                </form>
            </div>
        </div>
    );
};


// =====================================================================================
// --- MAIN APP COMPONENT ---
// =====================================================================================
const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('counter');
    const [userName, setUserName] = useLocalStorage<string | null>('userName', null);
    const [theme, setTheme] = useLocalStorage<Theme>('theme', 'light');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const [showSplash, setShowSplash] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setShowSplash(false), 2500);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const TAB_DATA = {
        counter: { title: 'Currency Counter', component: <CashCounter userName={userName!} />, icon: <CounterIcon /> },
        billing: { title: 'Billing', component: <Billing userName={userName!} />, icon: <BillingIcon /> },
        gst: { title: 'GST Calculator', component: <GstCalculator />, icon: <GstIcon /> },
    };

    if (showSplash) {
        return <SplashScreen />;
    }

    if (!userName) {
        return <LoginScreen onLogin={setUserName} />;
    }

    const handleLogout = () => {
        if(window.confirm("Are you sure you want to logout? All saved data will be cleared.")) {
            // Clear all application data from local storage for a clean session
            window.localStorage.clear();
            // Set user name to null to trigger rerender to the login screen
            setUserName(null);
        }
    };
    
    const toggleTheme = () => {
        setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
    };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-gradient-to-b from-slate-900 to-gray-900 text-slate-800 dark:text-slate-100 font-sans flex flex-col">
            <header className="bg-gradient-to-r from-purple-600 to-violet-700 text-white p-4 shadow-lg sticky top-0 z-30 flex justify-between items-center">
                <div>
                    <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">{TAB_DATA[activeTab].title}</h1>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                    <span className="hidden sm:block font-semibold text-right truncate">{userName}</span>
                    <div className="relative" ref={menuRef}>
                        <button onClick={() => setIsMenuOpen(prev => !prev)} className="p-2 rounded-full hover:bg-white/20 transition-colors">
                            <MenuIcon />
                        </button>
                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-md shadow-lg py-1 z-40 text-slate-700 dark:text-slate-200">
                                <div className="px-4 py-2 border-b dark:border-slate-700">
                                    <p className="text-sm font-semibold">My Account</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{userName}</p>
                                </div>
                                <button onClick={toggleTheme} className="w-full text-left px-4 py-2 text-sm flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700">
                                    <ThemeIcon /> Change Theme
                                </button>
                                <button onClick={() => { setIsFeedbackModalOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700">
                                    <FeedbackIcon /> Feedback
                                </button>
                                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700 text-red-600 dark:text-red-400">
                                    <LogoutIcon /> Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>
            
            <main className="flex-grow">
                {TAB_DATA[activeTab].component}
            </main>

            <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-around z-20">
                {Object.keys(TAB_DATA).map(key => {
                    const tab = TAB_DATA[key as ActiveTab];
                    const isActive = activeTab === key;
                    return (
                        <button key={key} onClick={() => setActiveTab(key as ActiveTab)} className={`flex-1 p-2 flex flex-col items-center justify-center text-xs transition-colors ${isActive ? 'text-violet-600 dark:text-violet-400' : 'text-slate-500 dark:text-slate-400 hover:text-violet-500'}`}>
                            {tab.icon}
                            <span className="mt-1">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                        </button>
                    )
                })}
            </nav>
            
            {isFeedbackModalOpen && <FeedbackModal onClose={() => setIsFeedbackModalOpen(false)} />}
        </div>
    );
};

export default App;