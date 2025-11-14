

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    signInAnonymously,
    User
} from 'firebase/auth';
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    addDoc,
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    collectionGroup,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';


// --- TYPE DEFINITIONS & THIRD-PARTY DECLARations ---
declare var html2canvas: any;
declare var jspdf: any;

type ActiveTab = 'counter' | 'billing' | 'gst' | 'admin';
type Theme = 'light' | 'dark';
interface BillItem { id: number; name: string; qty: number; price: number; }
interface CashHistoryEntry {
    id: string;
    date: Timestamp;
    totalAmount: number;
    totalNotes: number;
    counts: { [key: string]: string };
    expectedAmount: string;
}

// --- FIREBASE SETUP ---
// This has been updated with your project's configuration.
const firebaseConfig = {
  apiKey: "AIzaSyBA_sDtqblWEbnZptNf9nTe12LMkBBilHY",
  authDomain: "cash-denomenation.firebaseapp.com",
  projectId: "cash-denomenation",
  storageBucket: "cash-denomenation.firebasestorage.app",
  messagingSenderId: "1097944210180",
  appId: "1:1097944210180:web:851fea555fad8889b6ce51",
  measurementId: "G-KG5W9F34L5"
};

// Initialize Firebase using the v9 modular SDK
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// NOTE on Firestore Security Rules:
// For this app to be secure, you MUST set up Firestore Security Rules.
// Example rules:
// service cloud.firestore {
//   match /databases/{database}/documents {
//     // Users can only read/write their own data
//     match /users/{userId}/{document=**} {
//       allow read, write: if request.auth.uid == userId;
//     }
//     // Anyone authenticated can submit feedback
//     match /feedback/{feedbackId} {
//       allow create: if request.auth != null;
//     }
//   }
// }

const CURRENCY_DATA = [
    { id: 'note-500', value: 500, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/India_new_500_INR%2C_Mahatma_Gandhi_New_Series%2C_2016%2C_obverse.png/320px-India_new_500_INR%2C_Mahatma_Gandhi_New_Series%2C_2016%2C_obverse.png' },
    { id: 'note-200', value: 200, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/India_new_200_INR%2C_Mahatma_Gandhi_New_Series%2C_2017%2C_obverse.png/320px-India_new_200_INR%2C_Mahatma_Gandhi_New_Series%2C_2017%2C_obverse.png' },
    { id: 'note-100', value: 100, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/India_new_100_INR%2C_Mahatma_Gandhi_New_Series%2C_2018%2C_obverse.png/320px-India_new_100_INR%2C_Mahatma_Gandhi_New_Series%2C_2018%2C_obverse.png' },
    { id: 'note-50', value: 50, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/India_new_50_INR%2C_Mahatma_Gandhi_New_Series%2C_2017%2C_obverse.png/320px-India_new_50_INR%2C_Mahatma_Gandhi_New_Series%2C_2017%2C_obverse.png' },
    { id: 'note-20', value: 20, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/India_new_20_INR%2C_Mahatma_Gandhi_New_Series%2C_2019%2C_obverse.png/320px-India_new_20_INR%2C_Mahatma_Gandhi_New_Series%2C_2019%2C_obverse.png' },
    { id: 'note-10', value: 10, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/India_new_10_INR%2C_Mahatma_Gandhi_New_Series%2C_2018%2C_obverse.png/320px-India_new_10_INR%2C_Mahatma_Gandhi_New_Series%2C_2018%2C_obverse.png' },
    { id: 'note-5', value: 5, type: 'Note', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/India_5_INR%2C_MG_series%2C_2002%2C_obverse.png/320px-India_5_INR%2C_MG_series%2C_2002%2C_obverse.png'},
    { id: 'coin-10', value: 10, type: 'Coin', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/India-10-Rupee-coin-2019-observe.png/240px-India-10-Rupee-coin-2019-observe.png' },
    { id: 'coin-5', value: 5, type: 'Coin', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/India-5-Rupee-coin-2019-observe.png/240px-India-5-Rupee-coin-2019-observe.png' },
    { id: 'coin-2', value: 2, type: 'Coin', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/India-2-Rupee-coin-2019-observe.png/240px-India-2-Rupee-coin-2019-observe.png' },
    { id: 'coin-1', value: 1, type: 'Coin', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/India-1-Rupee-coin-2019-observe.png/240px-India-1-Rupee-coin-2019-observe.png' },
];
const NOTES = CURRENCY_DATA.filter(d => d.type === 'Note').sort((a, b) => b.value - a.value);
const COINS = CURRENCY_DATA.filter(d => d.type === 'Coin').sort((a, b) => b.value - a.value);

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
const CashCounter: React.FC<{ user: User }> = ({ user }) => {
    const [counts, setCounts] = useState<{ [key: string]: string }>({});
    const [history, setHistory] = useState<CashHistoryEntry[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [expectedAmount, setExpectedAmount] = useState('');
    const [isSummaryOpen, setIsSummaryOpen] = useState(false);
    const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const userStateRef = useMemo(() => doc(db, 'users', user.uid, 'appState', 'cashCounter'), [user.uid]);
    const historyRef = useMemo(() => collection(db, 'users', user.uid, 'cashCounterHistory'), [user.uid]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch saved state
                const stateDocSnap = await getDoc(userStateRef);
                if (stateDocSnap.exists()) {
                    const data = stateDocSnap.data();
                    setCounts(data?.counts || {});
                    setExpectedAmount(data?.expectedAmount || '');
                }
                // Fetch history
                const historyQuery = query(historyRef, orderBy('date', 'desc'), limit(50));
                const historySnapshot = await getDocs(historyQuery);
                setHistory(historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashHistoryEntry)));
            } catch (error) {
                console.error("Error fetching user data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user.uid, userStateRef, historyRef]);
    
    useEffect(() => {
        const handler = setTimeout(() => {
             setDoc(userStateRef, { counts, expectedAmount }, { merge: true });
        }, 1000);
        return () => clearTimeout(handler);
    }, [counts, expectedAmount, userStateRef]);

    const handleCountChange = (id: string, newCount: string) => {
        if (/^\d*$/.test(newCount)) {
            setCounts(prev => ({ ...prev, [id]: newCount }));
        }
    };
    
    const { totalAmount, totalNotesAndCoins } = useMemo(() => {
        return CURRENCY_DATA.reduce((acc, denom) => {
            const count = parseInt(counts[denom.id] || '0', 10);
            if (count > 0) {
                acc.totalAmount += denom.value * count;
                acc.totalNotesAndCoins += count;
            }
            return acc;
        }, { totalAmount: 0, totalNotesAndCoins: 0 });
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
                date: serverTimestamp(),
                userEmail: user.isAnonymous ? 'Guest' : user.email,
                totalAmount, totalNotes: totalNotesAndCoins, counts, expectedAmount,
            };
            try {
                const docRef = await addDoc(historyRef, newEntry);
                // Optimistically update UI
                const tempNewEntry = { ...newEntry, id: docRef.id, date: new Timestamp(Date.now()/1000, 0) } as CashHistoryEntry;
                setHistory([tempNewEntry, ...history]);
                alert('Count saved to history!');
            } catch (error) {
                console.error("Error saving to Firestore: ", error);
                alert("Could not save count. Please try again.");
            }
        }
    };
    
    const generateShareText = (entry: any) => {
        let text = `Cash Count Summary:\n`;
        text += `Total Amount: ₹${entry.totalAmount.toLocaleString('en-IN')}\n`;
        text += `Total Notes/Coins: ${entry.totalNotes}\n\n`;
        text += 'Denomination Breakdown:\n';
        CURRENCY_DATA.forEach(denom => {
            const count = parseInt(entry.counts[denom.id] || '0', 10);
            if (count > 0) {
                text += `₹${denom.value} × ${count} = ₹${(denom.value * count).toLocaleString('en-IN')}\n`;
            }
        });
         text += `\nShared by ${user.isAnonymous ? 'a Guest User' : (user.displayName || user.email)}`;
        return text;
    };

    const handleShare = () => {
        const textToShare = generateShareText({ totalAmount, totalNotes: totalNotesAndCoins, counts });
        if (navigator.share) {
            navigator.share({ title: 'Cash Count Summary', text: textToShare });
        } else {
            navigator.clipboard.writeText(textToShare);
            alert('Summary copied to clipboard!');
        }
    };
    
    const generateSingleEntryPdf = (entry: any) => {
        const { jsPDF } = jspdf;
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text("Cash Count Summary", 105, 15, null, null, "center");
        doc.setFontSize(12);
        doc.text(`Date: ${entry.date.toDate().toLocaleString('en-IN')}`, 15, 25);
        doc.text(`User: ${user.isAnonymous ? 'Guest' : user.email}`, 15, 32);

        doc.autoTable({
            startY: 40,
            head: [['Denomination', 'Count', 'Amount']],
            body: CURRENCY_DATA.map(denom => {
                const count = parseInt(entry.counts[denom.id] || '0', 10);
                return [ `₹ ${denom.value}`, count, `₹ ${(denom.value * count).toLocaleString('en-IN')}`];
            }).filter(row => (row[1] as number) > 0),
            foot: [
                ['Total', entry.totalNotes, `₹ ${entry.totalAmount.toLocaleString('en-IN')}`]
            ],
            theme: 'grid',
            headStyles: { fillColor: [76, 5, 255] }
        });
        addWatermark(doc);
        doc.save(`cash-summary-${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const DenominationRow = ({ denom }: { denom: typeof CURRENCY_DATA[0] }) => (
        <div key={denom.id} className="grid grid-cols-12 gap-2 items-center px-4 py-2">
            <div className="col-span-4 flex items-center gap-3">
                <img src={denom.imageUrl} alt={`₹ ${denom.value}`} className={`object-contain ${denom.type === 'Note' ? 'w-24 h-12' : 'w-10 h-10'}`}/>
                <span className="font-semibold text-slate-700 dark:text-slate-200 hidden sm:inline">{denom.type}</span>
            </div>
            <div className="col-span-3 flex items-center justify-center gap-2">
                <span className="text-xl font-medium text-slate-500 dark:text-slate-400">×</span>
                <input type="text" inputMode="numeric" pattern="\d*" value={counts[denom.id] || ''} onChange={(e) => handleCountChange(denom.id, e.target.value)} placeholder="0" className="w-full text-center text-xl font-bold rounded-lg p-2 bg-slate-100 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-violet-500"/>
            </div>
            <div className="col-span-5 text-right text-lg font-semibold text-violet-600 dark:text-violet-400 truncate">
                ₹{(denom.value * (parseInt(counts[denom.id] || '0', 10))).toLocaleString('en-IN')}
            </div>
        </div>
    );

    if (loading) return <div className="text-center p-10">Loading your data...</div>;
    
    return (
        <div className="flex-grow container mx-auto p-2 sm:p-4 pb-24">
            {showHistory ? (
                 <div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Counter History</h2>
                        <button onClick={() => setShowHistory(false)} className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm sm:text-base">Back to Counter</button>
                    </div>
                    <div className="space-y-2">
                        {history.length > 0 ? history.map(entry => (
                            <div key={entry.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-4">
                                <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedHistory(expandedHistory === entry.id ? null : entry.id)}>
                                    <div>
                                        <p className="font-semibold text-slate-800 dark:text-slate-200">{entry.date.toDate().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                        <p className="text-lg font-bold text-violet-600 dark:text-violet-400">₹{entry.totalAmount.toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); generateSingleEntryPdf(entry); }} className="p-2 text-slate-500 hover:text-violet-600 dark:hover:text-violet-400" aria-label="Download PDF">
                                            <DownloadIcon />
                                        </button>
                                        <svg className={`w-5 h-5 transition-transform ${expandedHistory === entry.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                                {expandedHistory === entry.id && (
                                    <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                                        <h4 className="font-semibold mb-2">Details:</h4>
                                        <div className="text-sm space-y-1">
                                            {entry.expectedAmount && parseFloat(entry.expectedAmount) > 0 && <p>Expected: ₹{parseFloat(entry.expectedAmount).toLocaleString('en-IN')}</p>}
                                            {entry.expectedAmount && parseFloat(entry.expectedAmount) > 0 && <p className={ (entry.totalAmount - parseFloat(entry.expectedAmount)) >= 0 ? 'text-green-500' : 'text-red-500'}>
                                                Difference: ₹{(entry.totalAmount - parseFloat(entry.expectedAmount)).toLocaleString('en-IN')}
                                            </p>}
                                            <p>Total Notes/Coins: {entry.totalNotes}</p>
                                        </div>
                                        <h4 className="font-semibold mt-4 mb-2">Breakdown:</h4>
                                        <ul className="text-sm space-y-1">
                                            {CURRENCY_DATA.map(denom => {
                                                const count = parseInt(entry.counts[denom.id] || '0', 10);
                                                if (count > 0) {
                                                    return <li key={denom.id}>₹{denom.value} &times; {count} = ₹{(denom.value * count).toLocaleString('en-IN')}</li>
                                                }
                                                return null;
                                            })}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )) : (
                            <p className="text-center text-slate-500 dark:text-slate-400 py-8">No history found.</p>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md overflow-hidden">
                            <h2 className="text-lg font-bold p-4 bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">Notes</h2>
                            <div className="divide-y divide-slate-200 dark:divide-slate-700">
                                {NOTES.map(denom => <DenominationRow key={denom.id} denom={denom} />)}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md overflow-hidden">
                            <h2 className="text-lg font-bold p-4 bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">Coins</h2>
                            <div className="divide-y divide-slate-200 dark:divide-slate-700">
                                {COINS.map(denom => <DenominationRow key={denom.id} denom={denom} />)}
                            </div>
                        </div>
                    </div>
                    {/* Summary Bar */}
                    <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700 p-2 sm:p-4 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
                        <div className="container mx-auto">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div className="flex-grow grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                    <div>
                                        <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 block">Total Amount</span>
                                        <span className="font-bold text-lg sm:text-xl text-violet-600 dark:text-violet-400">₹{totalAmount.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div>
                                        <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 block">Total Items</span>
                                        <span className="font-bold text-lg sm:text-xl">{totalNotesAndCoins}</span>
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <input type="text" inputMode="numeric" value={expectedAmount} onChange={(e) => setExpectedAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Expected Amount" className="w-full text-center text-sm rounded-lg p-2 bg-slate-100 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-violet-500"/>
                                    </div>
                                    <div>
                                       <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 block">Difference</span>
                                        <span className={`font-bold text-lg sm:text-xl ${difference === null ? '' : difference >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {difference === null ? '...' : `₹${difference.toLocaleString('en-IN')}`}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-center gap-2 mt-2 sm:mt-0">
                                    <button onClick={handleClear} className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm sm:text-base">Clear</button>
                                    <button onClick={handleSave} className="px-3 py-2 bg-green-500 text-white rounded-lg text-sm sm:text-base">Save</button>
                                    <button onClick={handleShare} className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm sm:text-base">Share</button>
                                    <button onClick={() => setShowHistory(true)} className="px-3 py-2 bg-slate-600 text-white rounded-lg text-sm sm:text-base">History</button>
                                </div>
                            </div>
                            {totalAmount > 0 && <div className="text-center text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 font-semibold">
                                {numberToWordsIn(totalAmount)} Rupees Only
                            </div>}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// =====================================================================================
// --- PLACEHOLDER COMPONENTS ---
// =====================================================================================
const Billing: React.FC = () => <div className="p-4 text-center">Billing Feature Coming Soon!</div>;
const GstCalculator: React.FC = () => <div className="p-4 text-center">GST Calculator Coming Soon!</div>;
const AdminPanel: React.FC<{ user: User }> = ({ user }) => <div className="p-4 text-center">Admin Panel Coming Soon!</div>;

// =====================================================================================
// --- LOGIN SCREEN COMPONENT ---
// =====================================================================================
const LoginScreen: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
        } catch (err: any) {
            setError(err.message);
        }
    };
    
    const handleGoogleSignIn = async () => {
        setError('');
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (err: any) {
            setError(err.message);
        }
    };
    
    const handleGuestSignIn = async () => {
        setError('');
        try {
            await signInAnonymously(auth);
        } catch(err: any) {
            setError(err.message);
        }
    };

    return (
         <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-gray-900 p-4">
            <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 sm:p-8">
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Welcome!</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Sign in to continue</p>
                </div>
                {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-center text-sm">{error.replace('Firebase: ', '')}</p>}
                <form onSubmit={handleAuth} className="space-y-4">
                    <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-700 border-2 border-transparent focus:border-violet-500 focus:ring-violet-500 outline-none transition" />
                    <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-700 border-2 border-transparent focus:border-violet-500 focus:ring-violet-500 outline-none transition" />
                    <button type="submit" className="w-full bg-violet-600 text-white font-bold py-3 rounded-lg hover:bg-violet-700 transition-transform transform hover:scale-105 duration-300">
                        {isLogin ? 'Login' : 'Sign Up'}
                    </button>
                </form>
                <div className="text-center my-4">
                    <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-violet-500 hover:underline">
                        {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'}
                    </button>
                </div>
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-300 dark:border-slate-600"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400">OR</span>
                    </div>
                </div>
                 <div className="space-y-3">
                    <button onClick={handleGoogleSignIn} className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-3 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition">
                        <GoogleIcon />
                        <span>Sign in with Google</span>
                    </button>
                    <button onClick={handleGuestSignIn} className="w-full bg-orange-500 text-white font-bold py-3 rounded-lg hover:bg-orange-600 transition-transform transform hover:scale-105 duration-300">
                        Login as Guest
                    </button>
                </div>
            </div>
        </div>
    );
};

// =====================================================================================
// --- FEEDBACK MODAL COMPONENT ---
// =====================================================================================
const FeedbackModal: React.FC<{user: User, onClose: () => void}> = ({ user, onClose }) => {
    const [feedback, setFeedback] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!feedback.trim()) return;
        setIsSubmitting(true);
        setMessage('');
        try {
            await addDoc(collection(db, 'feedback'), {
                text: feedback,
                userEmail: user.isAnonymous ? 'Guest' : user.email,
                uid: user.uid,
                timestamp: serverTimestamp(),
                userAgent: navigator.userAgent
            });
            setMessage('Thank you for your feedback!');
            setFeedback('');
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (error) {
            console.error("Error submitting feedback: ", error);
            setMessage('Failed to send feedback. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-6 relative">
                 <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><CloseIcon/></button>
                <h2 className="text-xl font-bold mb-4">Submit Feedback</h2>
                <form onSubmit={handleSubmit}>
                    <textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Tell us what you think..." rows={5} className="w-full p-2 rounded-md bg-slate-100 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-violet-500 mb-4"></textarea>
                    <button type="submit" disabled={isSubmitting} className="w-full bg-violet-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-violet-700 disabled:bg-violet-400">
                        {isSubmitting ? 'Sending...' : 'Send Feedback'}
                    </button>
                    {message && <p className={`mt-4 text-center text-sm ${message.includes('Failed') ? 'text-red-500' : 'text-green-500'}`}>{message}</p>}
                </form>
            </div>
        </div>
    );
};

// =====================================================================================
// --- NAVIGATION BUTTON COMPONENT ---
// =====================================================================================
const NavButton: React.FC<{active?: boolean, onClick: () => void, children: React.ReactNode, isSidebar?: boolean}> = ({ active, onClick, children, isSidebar }) => (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${
        isSidebar ? 'w-full text-left' : ''
    } ${
        active 
        ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300' 
        : 'hover:bg-slate-100 dark:hover:bg-slate-700'
    }`}>
        {children}
    </button>
);

// =====================================================================================
// --- MAIN APP COMPONENT ---
// =====================================================================================
const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('counter');
    const [theme, setTheme] = useLocalStorage<Theme>('theme', 'light');
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isFeedbackOpen, setFeedbackOpen] = useState(false);
    const [showSplash, setShowSplash] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setShowSplash(false), 2400); // Splash screen duration
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [theme]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSignOut = async () => {
        await signOut(auth);
    };

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };
    
    const isAdmin = user && user.email === ADMIN_EMAIL;

    const renderContent = () => {
        if (!user) return null; // Should not happen if AppContent is rendered
        switch (activeTab) {
            case 'counter': return <CashCounter user={user} />;
            case 'billing': return <Billing />;
            case 'gst': return <GstCalculator />;
            case 'admin': return isAdmin ? <AdminPanel user={user} /> : <div className="p-4 text-center text-red-500">Access Denied.</div>;
            default: return <CashCounter user={user} />;
        }
    };
    
    if (showSplash) {
        return <SplashScreen />;
    }

    if (loading) {
        return <div className="h-screen flex items-center justify-center dark:bg-gray-900 dark:text-white">Loading...</div>;
    }
    
    if (!user) {
        return <LoginScreen />;
    }
    
    // Main App UI (Header, Sidebar, Content)
    return (
        <div className="flex h-screen bg-slate-100 dark:bg-gray-900 text-slate-900 dark:text-slate-100 font-sans">
             {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-md">
                <div className="container mx-auto px-4 h-16 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 lg:hidden">
                            {isSidebarOpen ? <CloseIcon /> : <MenuIcon />}
                        </button>
                        <h1 className="text-xl font-bold text-violet-600 dark:text-violet-400">CashDenom</h1>
                    </div>
                    <div className="hidden lg:flex items-center gap-2">
                        {/* Desktop Nav */}
                        <NavButton active={activeTab === 'counter'} onClick={() => setActiveTab('counter')}><CounterIcon /> Counter</NavButton>
                        <NavButton active={activeTab === 'billing'} onClick={() => setActiveTab('billing')}><BillingIcon /> Billing</NavButton>
                        <NavButton active={activeTab === 'gst'} onClick={() => setActiveTab('gst')}><GstIcon /> GST Calc</NavButton>
                        {isAdmin && <NavButton active={activeTab === 'admin'} onClick={() => setActiveTab('admin')}><AdminIcon /> Admin</NavButton>}
                    </div>
                    <div className="flex items-center gap-3">
                         <div className="flex items-center text-sm gap-2">
                            <UserIcon />
                            <span className="hidden sm:inline">{user.isAnonymous ? 'Guest' : (user.displayName || user.email)}</span>
                         </div>
                        <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><ThemeIcon /></button>
                        <button onClick={() => setFeedbackOpen(true)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 hidden sm:block"><FeedbackIcon /></button>
                        <button onClick={handleSignOut} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><LogoutIcon /></button>
                    </div>
                </div>
            </header>
            
            {/* Sidebar (Mobile) */}
             <aside className={`fixed top-0 left-0 z-30 w-64 h-full pt-16 bg-white dark:bg-slate-800 shadow-xl transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:hidden`}>
                <nav className="p-4 space-y-2">
                    <NavButton isSidebar active={activeTab === 'counter'} onClick={() => {setActiveTab('counter'); setSidebarOpen(false);}}><CounterIcon /> Currency Counter</NavButton>
                    <NavButton isSidebar active={activeTab === 'billing'} onClick={() => {setActiveTab('billing'); setSidebarOpen(false);}}><BillingIcon /> Billing</NavButton>
                    <NavButton isSidebar active={activeTab === 'gst'} onClick={() => {setActiveTab('gst'); setSidebarOpen(false);}}><GstIcon /> GST Calculator</NavButton>
                    {isAdmin && <NavButton isSidebar active={activeTab === 'admin'} onClick={() => {setActiveTab('admin'); setSidebarOpen(false);}}><AdminIcon /> Admin Panel</NavButton>}
                    <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>
                    <button onClick={() => {setFeedbackOpen(true); setSidebarOpen(false);}} className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                        <FeedbackIcon /> Feedback
                    </button>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="w-full pt-16 overflow-y-auto">
                {renderContent()}
            </main>
            
            {isFeedbackOpen && <FeedbackModal user={user} onClose={() => setFeedbackOpen(false)} />}
        </div>
    );
};


export default App;
