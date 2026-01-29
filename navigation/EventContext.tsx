import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventContext } from './types';

const SESSION_STORAGE_KEY = 'zorphix_user_session';

interface EventContextType {
    eventContext: EventContext | null;
    setEventContext: (context: EventContext | null) => void;
    isLoading: boolean;  // To show loading while checking session
}

const EventContextReact = createContext<EventContextType | undefined>(undefined);

export const EventProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [eventContext, setEventContextState] = useState<EventContext | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load session from AsyncStorage on mount
    useEffect(() => {
        const loadSession = async () => {
            try {
                const savedSession = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
                if (savedSession) {
                    const parsedSession = JSON.parse(savedSession) as EventContext;
                    // console.log('✅ Restored session:', parsedSession.adminEmail);
                    setEventContextState(parsedSession);
                }
            } catch (error) {
                console.error('Failed to load session:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadSession();
    }, []);

    // Custom setter that also persists to AsyncStorage
    const setEventContext = async (context: EventContext | null) => {
        setEventContextState(context);

        try {
            if (context) {
                await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(context));
                // console.log('💾 Session saved:', context.adminEmail);
            } else {
                await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
                // console.log('🗑️ Session cleared');
            }
        } catch (error) {
            console.error('Failed to persist session:', error);
        }
    };

    return (
        <EventContextReact.Provider value={{ eventContext, setEventContext, isLoading }}>
            {children}
        </EventContextReact.Provider>
    );
};

export const useEventContext = (): EventContextType => {
    const context = useContext(EventContextReact);
    if (!context) {
        throw new Error('useEventContext must be used within an EventProvider');
    }
    return context;
};
