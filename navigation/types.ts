export type Event = {
    id: string;
    title: string;
    category: 'Technical' | 'Non-Technical' | 'Workshop';
    date: string;
    description: string;
};

export type RootStackParamList = {
    Login: undefined;
    Home: undefined;
    EventDetail: { event: Event };
    Registration: undefined;
    QRScanner: undefined;
    DatabaseViewer: undefined;
};
