// Event context for the logged-in admin
export type EventContext = {
    eventName: string;
    adminEmail: string;
};

export type RootStackParamList = {
    Login: undefined;
    Home: undefined;
    Registration: {
        prefilledUID?: string;
        prefilledName?: string;
        prefilledEmail?: string;
        prefilledPhone?: string;
        prefilledCollege?: string;
        prefilledDept?: string;
        prefilledYear?: string;
    } | undefined;
    QRScanner: {
        mode?: 'INDIVIDUAL' | 'TEAM';
        teamSize?: number;
        teamName?: string; // Add team name parameter

    } | undefined;
    DatabaseViewer: undefined;
    RecentRegistrations: undefined;
    Export: undefined;
    Import: undefined;
};

// Participant data structure matching Firebase schema
export interface Participant {
    uid: string;
    event_id: string;
    name: string;
    email: string;
    phone: string;
    college: string;
    college_other: string;
    degree: string;
    degree_other: string;
    department: string;
    department_other: string;
    year: string;
    checked_in: number;
    checkin_time: string | null;
    source: 'WEB' | 'ONSPOT';
    sync_status: number;
    payment_verified: number;
    participated: number;
}

// College options for dropdown
export const COLLEGES = [
    'Chennai Institute of Technology',
    'Anna University',
    'SRM Institute of Science and Technology',
    'VIT Chennai',
    'Sathyabama Institute of Science and Technology',
    'Other'
];

// Degree options
export const DEGREES = [
    'B.Tech',
    'B.E',
    'M.Tech',
    'M.E',
    'MCA',
    'BCA',
    'B.Sc',
    'M.Sc',
    'Other'
];

// Department options
export const DEPARTMENTS = [
    'Computer Science and Engineering',
    'Information Technology',
    'Electronics and Communication Engineering',
    'Electrical and Electronics Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Artificial Intelligence and Data Science',
    'Cyber Security',
    'Other'
];

// Year options
export const YEARS = ['1', '2', '3', '4'];

// Event Admin Email Mappings (for reference)
// These must match the 'event_admins' collection in Firebase
export const EVENT_ADMIN_EMAILS: { email: string; eventName: string }[] = [
    // Technical Events
    { email: 'pixelreforge@zorphix.com', eventName: 'Pixel Reforge' },
    { email: 'promptcraft@zorphix.com', eventName: 'PromptCraft' },
    { email: 'algopulse@zorphix.com', eventName: 'AlgoPulse' },
    { email: 'reversecoding@zorphix.com', eventName: 'Reverse Coding' },
    { email: 'siptosurvive@zorphix.com', eventName: 'Sip to Survive' },
    { email: 'codecrypt@zorphix.com', eventName: 'CodeCrypt' },
    { email: 'linklogic@zorphix.com', eventName: 'LinkLogic' },
    { email: 'pitchfest@zorphix.com', eventName: 'Pitchfest' },

    // Paper Presentation
    { email: 'paperpresentation@zorphix.com', eventName: 'Paper Presentation' },

    // Workshops
    { email: 'fintech@zorphix.com', eventName: 'FinTech 360°' },
    { email: 'wealthx@zorphix.com', eventName: 'WealthX' },

    // Master Admin (has access to all events)
    { email: 'admin@zorphix.com', eventName: 'ALL' },
];

// Get all unique event names
export const ALL_EVENTS = [
    'Pixel Reforge',
    'PromptCraft',
    'AlgoPulse',
    'Reverse Coding',
    'Sip to Survive',
    'CodeCrypt',
    'LinkLogic',
    'Pitchfest',
    'Paper Presentation',
    'FinTech 360°',
    'WealthX'
];

// Paid events list
export const PAID_EVENTS = ['FinTech 360°', 'WealthX', 'Paper Presentation'];
