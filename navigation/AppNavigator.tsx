import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import RegistrationScreen from '../screens/RegistrationScreen';
import QRScannerScreen from '../screens/QRScannerScreen';
import DatabaseViewerScreen from '../screens/DatabaseViewerScreen';
import { RootStackParamList } from './types';

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator = () => {
    return (
        <Stack.Navigator initialRouteName="Login" screenOptions={{
            headerStyle: {
                backgroundColor: '#000000',
                shadowColor: 'transparent',
                elevation: 0,
                borderBottomWidth: 1,
                borderBottomColor: '#333'
            },
            headerTintColor: '#FFD700',
            headerTitleStyle: {
                fontWeight: 'bold',
                fontSize: 20,
            },
            cardStyle: { backgroundColor: '#000000' }
        }}>
            <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    title: 'Zorphix',
                    headerLeft: () => null
                }}
            />
            <Stack.Screen
                name="EventDetail"
                component={EventDetailScreen}
                options={{ title: 'Event Details' }}
            />
            <Stack.Screen
                name="Registration"
                component={RegistrationScreen}
                options={{ title: 'Register' }}
            />
            <Stack.Screen
                name="QRScanner"
                component={QRScannerScreen}
                options={{ title: 'Scan QR' }}
            />
            <Stack.Screen
                name="DatabaseViewer"
                component={DatabaseViewerScreen}
                options={{ title: 'Local Database' }}
            />
        </Stack.Navigator>
    );
};

export default AppNavigator;
