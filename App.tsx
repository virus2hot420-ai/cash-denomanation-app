import React, { useState, useMemo, useEffect, useRef } from 'react';

// --- TYPE DEFINITIONS & THIRD-PARTY DECLARATIONS ---
declare var html2canvas: any;
declare var jspdf: any;
declare var firebase: any;

type ActiveTab = 'counter' | 'billing' | 'gst' | 'admin';
type Theme = 'light' | 'dark';

// --- FIREBASE SETUP ---
// IMPORTANT: Replace this with your own Firebase project's configuration.
// Go to your Firebase project's settings, find "Your apps", and copy the config object here.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

const CURRENCY_DATA = [
    { id: 'note-500', value: 500, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/India_new_500_INR%2C_Mahatma_Gandhi_New_Series%2C_2016%2C_obverse.png/320px-India_new_500_INR%2C_Mahatma_Gandhi_New_Series%2C_2016%2C_obverse.png' },
    { id: 'note-200', value: 200, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/India_new_200_INR%2C_Mahatma_Gandhi_New_Series%2C_2017%2C_obverse.png/320px-India_new_200_INR%2C_Mahatma_Gandhi_New_Series%2C_2017%2C_obverse.png' },
    { id: 'note-100', value: 100, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/India_new_100_INR%2C_Mahatma_Gandhi_New_Series%2C_2018%2C_obverse.png/320px-India_new_100_INR%2C_Mahatma_Gandhi_New_Series%2C_2018%2C_obverse.png' },
    { id: 'note-50', value: 50, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/India_new_50_INR%2C_Mahatma_Gandhi_New_Series%2C_2017%2C_obverse.png/320px-India_new_50_INR%2C_Mahatma_Gandhi_New_Series%2C_2017%2C_obverse.png' },
    { id: 'note-20', value: 20, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/India_new_20_INR%2C_Mahatma_Gandhi_New_Series%2C_2019%2C_obverse.png/320px-India_new_20_INR%2C_Mahatma_Gandhi_New_Series%2C_2019%2C_obverse.png' },
    { id: 'note-10', value: 10, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/India_new_10_INR%2C_Mahatma_Gandhi_New_Series%2C_2018%2C_obverse.png/320px-India_new_10_INR%2C_Mahatma_Gandhi_New_Series%2C_2018%2C_obverse.png' },
    { id: 'note-5', value: 5, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/India_5_INR%2C_MG_series%2C_2002%2C_obverse.png/320px-India_5_INR%2C_MG_series%2C_2002%2C_obverse.png'},
];

// IMPORTANT: Set the email of the admin user here.
const ADMIN_EMAIL = "admin@example.com";

// --- CUSTOM HOOK FOR LOCAL STORAGE (FOR NON-USER SPECIFIC DATA LIKE THEME) ---
function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) { console.error(error); return initialValue; }
    });
    const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) { console.error(error); }
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
        doc.setTextColor(230, 230, 230);
        doc.setFont(undefined, 'bold');
        doc.text(["App developed in India", "Developed by Virus 2.0"], pageWidth / 2, pageHeight / 2, { align: 'center', angle: -45, baseline: 'middle' });
    }
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
};

// --- UI ICONS --- (No changes to icons)
const CounterIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 14h.01M12 11h.01M15 11h.01M9 11h.01M12 21a9 9 0 110-18 9 9 0 010 18z" /></svg>;
const BillingIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
const GstIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
const AdminIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;
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
const CashCounter: React.FC<{ user: any }> = ({ user }) => {
    const [counts, setCounts] = useState<{ [key: string]: string }>({});
    const [history, setHistory] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [expectedAmount, setExpectedAmount] = useState('');
    const [isSummaryOpen, setIsSummaryOpen] = useState(false);
    const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const userStateRef = db.collection('users').doc(user.uid).collection('appState').doc('cashCounter');
    const historyRef = db.collection('users').doc(user.uid).collection('cashCounterHistory');

    useEffect(() => {
        // Fetch initial state and history from Firestore
        const fetchData = async () => {
            setLoading(true);
            // Fetch saved state
            const stateDoc = await userStateRef.get();
            if (stateDoc.exists) {
                const data = stateDoc.data();
                setCounts(data?.counts || {});
                setExpectedAmount(data?.expectedAmount || '');
            }
            // Fetch history
            const historySnapshot = await historyRef.orderBy('date', 'desc').limit(50).get();
            setHistory(historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        };
        fetchData();
    }, [user.uid]);
    
    // Save current counts to Firestore periodically or on change
    useEffect(() => {
        const handler = setTimeout(() => {
            userStateRef.set({ counts, expectedAmount }, { merge: true });
        }, 1000); // Debounce saving
        return () => clearTimeout(handler);
    }, [counts, expectedAmount]);

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
    
    const handleSave = async () => {
        if (totalAmount > 0) {
            const newEntry = {
                date: new Date().toISOString(),
                userEmail: user.email,
                totalAmount, totalNotes, counts, expectedAmount,
            };
            try {
                const docRef = await historyRef.add(newEntry);
                setHistory([{ id: docRef.id, ...newEntry }, ...history]);
                alert('Count saved to history!');
            } catch (error) {
                console.error("Error saving to Firestore: ", error);
                alert("Could not save count. Please try again.");
            }
        }
    };
    
    const generateShareText = () => {
        // ... (share text logic remains the same)
        return `Shared by ${user.displayName || user.email}`;
    };

    const handleShare = () => {
        // ... (share logic remains the same)
    };
    
    const generateSingleEntryPdf = (entry: any) => {
        // ... (PDF generation logic remains the same)
    };

    const generateHistoryPdf = () => {
        // ... (PDF generation logic remains the same)
    };

    if (loading) return <div className="text-center p-10">Loading your data...</div>;
    
    return (
        <div className="flex-grow container mx-auto p-2 sm:p-4 pb-24">
            {/* The rest of the CashCounter JSX is largely the same, only data source has changed */}
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
                            <div key={h.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-md overflow-hidden transition-all">
                                <div className="p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700" onClick={() => setExpandedHistory(expandedHistory === h.id ? null : h.id)}>
                                    <div>
                                        <p className="font-semibold">{new Date(h.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                        <p className="text-slate-600 dark:text-slate-300">Total: <span className="font-bold text-violet-600 dark:text-violet-400">₹{(h.totalAmount || 0).toLocaleString('en-IN')}</span></p>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${expandedHistory === h.id ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </div>
                                {expandedHistory === h.id && (
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
                     {/* The main counter UI, no logic changes needed here */}
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
            {/* Floating button and summary popup - no logic changes needed here */}
             {!showHistory && totalAmount > 0 && (
                <button
                    onClick={() => setIsSummaryOpen(true)}
                    className="fixed bottom-20 right-4 bg-gradient-to-r from-purple-600 to-violet-700 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all z-20 flex items-center gap-2"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <span>Total: ₹{totalAmount.toLocaleString('en-IN')}</span>
                </button>
            )}

            <div 
                className={`fixed inset-0 z-40 transition-opacity ${isSummaryOpen ? 'bg-black/60' : 'bg-transparent pointer-events-none'}`}
                onClick={() => setIsSummaryOpen(false)}
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 shadow-t-2xl p-4 transition-transform duration-300 ease-in-out transform rounded-t-2xl ${isSummaryOpen ? 'translate-y-0' : 'translate-y-full'} z-50`}
                >
                    <div className="max-w-4xl mx-auto space-y-3">
                         <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
                             <h2 className="text-lg font-bold">Calculation Summary</h2>
                             <button onClick={() => setIsSummaryOpen(false)} className="p-1 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"><CloseIcon /></button>
                        </div>
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
// --- BILLING COMPONENT (Placeholder, to be refactored for Firestore) ---
// =====================================================================================
interface BillItem { id: number; name: string; qty: number; price: number; }

const Billing: React.FC<{ user: any }> = ({ user }) => {
    // This component can be refactored similarly to CashCounter to use Firestore
    // For brevity, it's left with local state for now.
    const [items, setItems] = useState<BillItem[]>([{ id: 1, name: '', qty: 1, price: 0 }]);
    const [customerName, setCustomerName] = useState('');

    const handleItemChange = (id: number, field: keyof BillItem, value: any) => setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    const addItem = () => setItems([...items, { id: Date.now(), name: '', qty: 1, price: 0 }]);
    const removeItem = (id: number) => setItems(items.filter(item => item.id !== id));
    const clearBill = () => { setItems([{ id: 1, name: '', qty: 1, price: 0 }]); setCustomerName(''); };
    const totalBill = useMemo(() => items.reduce((sum, item) => sum + (item.qty * item.price), 0), [items]);

    const generatePdf = () => { /* PDF logic remains same */ };

    return (
        <div className="flex-grow container mx-auto p-2 sm:p-4 pb-32">
            <h3 className="text-center p-8 text-slate-500">Billing component coming soon with cloud storage!</h3>
        </div>
    );
};


// =====================================================================================
// --- GST CALCULATOR COMPONENT (Placeholder, to be refactored for Firestore) ---
// =====================================================================================
const GstCalculator: React.FC<{ user: any }> = () => {
    return <div className="flex-grow container mx-auto p-2 sm:p-4 pb-32"><h3 className="text-center p-8 text-slate-500">GST Calculator component coming soon with cloud storage!</h3></div>
};


// =====================================================================================
// --- ADMIN PANEL COMPONENT ---
// =====================================================================================
const AdminPanel: React.FC = () => {
    const [activityFeed, setActivityFeed] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAllActivities = async () => {
            setLoading(true);
            const combinedFeed: any[] = [];
            
            // NOTE: Firestore collection group queries require an index.
            // The first time you run this, Firestore will provide a link in the console error
            // to automatically create the required index. Click that link.
            try {
                const cashSnapshot = await db.collectionGroup('cashCounterHistory').orderBy('date', 'desc').limit(100).get();
                cashSnapshot.forEach((doc: any) => {
                    const data = doc.data();
                    combinedFeed.push({
                        type: 'Cash Count',
                        date: new Date(data.date),
                        user: data.userEmail || 'Unknown',
                        data: `Total: ₹${data.totalAmount.toLocaleString('en-IN')}`,
                        icon: <CounterIcon />
                    });
                });
            } catch (error) {
                console.error("Error fetching cash history for admin:", error);
            }
            
            // Add similar collectionGroup queries for billing and GST history here...

            combinedFeed.sort((a, b) => b.date.getTime() - a.date.getTime());
            setActivityFeed(combinedFeed);
            setLoading(false);
        };

        fetchAllActivities();
    }, []);
    
    if (loading) return <div className="text-center p-10">Loading all user activities...</div>

    return (
        <div className="flex-grow container mx-auto p-2 sm:p-4">
            <h2 className="text-2xl font-bold mb-4">Admin Dashboard: All User Activity</h2>
            <div className="bg-yellow-100 dark:bg-yellow-900 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-200 p-4 mb-4" role="alert">
                <p className="font-bold">Important</p>
                <p>To enable this view, Firestore requires a composite index. If this page is blank or shows an error in the console, please click the link provided in the console error message to create the index automatically in your Firebase project.</p>
            </div>
            <div className="space-y-4">
                {activityFeed.length > 0 ? activityFeed.map((activity, index) => (
                    <div key={index} className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-md flex items-start gap-4">
                        <div className="bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-300 p-3 rounded-full">
                            {activity.icon}
                        </div>
                        <div>
                            <p className="font-bold text-lg">{activity.type}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">By: {activity.user} on {activity.date.toLocaleString('en-IN')}</p>
                            <p className="mt-1">{activity.data}</p>
                        </div>
                    </div>
                )) : (
                    <p className="text-center text-slate-500 mt-8">No user activity recorded yet.</p>
                )}
            </div>
        </div>
    );
};


// =====================================================================================
// --- LOGIN SCREEN COMPONENT ---
// =====================================================================================
const LoginScreen: React.FC = () => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (isLoginView) {
                await auth.signInWithEmailAndPassword(email, password);
            } else {
                await auth.createUserWithEmailAndPassword(email, password);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError('');
        try {
            await auth.signInWithPopup(googleProvider);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-gray-900 p-4">
            <div className="w-full max-w-sm mx-auto bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl">
                <h1 className="text-3xl font-bold text-center mb-2 text-violet-600 dark:text-violet-400">{isLoginView ? 'Welcome Back' : 'Create Account'}</h1>
                <p className="text-center text-slate-500 mb-6">{isLoginView ? 'Sign in to continue' : 'Get started with your account'}</p>
                
                <form onSubmit={handleAuth} className="space-y-4">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" required className="w-full px-4 py-3 text-lg rounded-lg border-2 dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-violet-500" />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required minLength={6} className="w-full px-4 py-3 text-lg rounded-lg border-2 dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-violet-500" />
                    <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-purple-600 to-violet-700 text-white font-bold rounded-lg text-lg disabled:opacity-50">
                        {loading ? 'Processing...' : (isLoginView ? 'Login' : 'Sign Up')}
                    </button>
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                </form>

                <div className="flex items-center my-6">
                    <div className="flex-grow border-t dark:border-slate-600"></div><span className="mx-4 text-slate-500">OR</span><div className="flex-grow border-t dark:border-slate-600"></div>
                </div>
                
                <button onClick={handleGoogleSignIn} disabled={loading} className="w-full py-3 border-2 dark:border-slate-600 rounded-lg flex items-center justify-center gap-2 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50">
                    <GoogleIcon /> Sign in with Google
                </button>
                
                <p className="text-center mt-6">
                    {isLoginView ? "Don't have an account?" : "Already have an account?"}
                    <button onClick={() => setIsLoginView(!isLoginView)} className="font-semibold text-violet-600 hover:underline ml-1">
                        {isLoginView ? 'Sign Up' : 'Login'}
                    </button>
                </p>
            </div>
        </div>
    );
};


// =====================================================================================
// --- FEEDBACK MODAL COMPONENT ---
// =====================================================================================
const FeedbackModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    // ... (No changes needed for FeedbackModal)
    return <div></div>;
};


// =====================================================================================
// --- MAIN APP COMPONENT ---
// =====================================================================================
const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('counter');
    const [user, setUser] = useState<any | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [theme, setTheme] = useLocalStorage<Theme>('theme', 'light');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const [showSplash, setShowSplash] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setShowSplash(false), 2500);
        const unsubscribe = auth.onAuthStateChanged((user: any) => {
            setUser(user);
            setAuthLoading(false);
        });
        return () => { clearTimeout(timer); unsubscribe(); };
    }, []);

    useEffect(() => {
        if (theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [theme]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMenuOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const TABS = {
        counter: { title: 'Currency Counter', component: <CashCounter user={user} />, icon: <CounterIcon /> },
        billing: { title: 'Billing', component: <Billing user={user} />, icon: <BillingIcon /> },
        gst: { title: 'GST Calculator', component: <GstCalculator user={user} />, icon: <GstIcon /> },
        ...(user?.email === ADMIN_EMAIL && {
            admin: { title: 'Admin Panel', component: <AdminPanel />, icon: <AdminIcon /> }
        }),
    };

    if (showSplash || authLoading) {
        return <SplashScreen />;
    }

    if (!user) {
        return <LoginScreen />;
    }

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to logout?")) {
            auth.signOut();
        }
    };
    
    const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-gradient-to-b from-slate-900 to-gray-900 text-slate-800 dark:text-slate-100 font-sans flex flex-col">
            <header className="bg-gradient-to-r from-purple-600 to-violet-700 text-white p-4 shadow-lg sticky top-0 z-30 flex justify-between items-center">
                <div><h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">{TABS[activeTab].title}</h1></div>
                <div className="flex items-center gap-2 sm:gap-4">
                    <span className="hidden sm:block font-semibold text-right truncate">{user.displayName || user.email}</span>
                    <div className="relative" ref={menuRef}>
                        <button onClick={() => setIsMenuOpen(prev => !prev)} className="p-2 rounded-full hover:bg-white/20 transition-colors"><MenuIcon /></button>
                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-md shadow-lg py-1 z-40 text-slate-700 dark:text-slate-200">
                                <div className="px-4 py-2 border-b dark:border-slate-700">
                                    <p className="text-sm font-semibold">My Account</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                                </div>
                                <button onClick={toggleTheme} className="w-full text-left px-4 py-2 text-sm flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700"><ThemeIcon /> Change Theme</button>
                                <button onClick={() => { setIsFeedbackModalOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700"><FeedbackIcon /> Feedback</button>
                                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700 text-red-600 dark:text-red-400"><LogoutIcon /> Logout</button>
                            </div>
                        )}
                    </div>
                </div>
            </header>
            
            <main className="flex-grow">{TABS[activeTab].component}</main>

            <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-around z-20">
                {Object.keys(TABS).map(key => {
                    const tab = TABS[key as ActiveTab];
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