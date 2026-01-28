import React from 'react';
import { Platform } from 'react-native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import RegistrationScreen from '../screens/RegistrationScreen';
import QRScannerScreen from '../screens/QRScannerScreen';
import DatabaseViewerScreen from '../screens/DatabaseViewerScreen';
import RecentRegistrationsScreen from '../screens/RecentRegistrationsScreen';
import ExportScreen from '../screens/ExportScreen';
import ImportScreen from '../screens/ImportScreen';
import SearchScreen from '../screens/SearchScreen';
import TeamScannerLauncher from '../screens/TeamScannerLauncher';
import { RootStackParamList } from './types';

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator = () => {
    return (
        <Stack.Navigator
            initialRouteName="Login"
            screenOptions={{
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
                cardStyle: { backgroundColor: '#000000' },
                ...(Platform.OS === 'web' && {
                    animationEnabled: false,
                    cardStyleInterpolator: CardStyleInterpolators.forNoAnimation,
                }),
            }}
            detachInactiveScreens={false}
        >
            <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    headerShown: false,
                    gestureEnabled: false
                }}
            />
            <Stack.Screen
                name="Registration"
                component={RegistrationScreen}
                options={{ title: 'New Registration' }}
            />
            <Stack.Screen
                name="QRScanner"
                component={QRScannerScreen}
                options={{ title: 'Verify Enrollment' }}
            />
            <Stack.Screen
                name="DatabaseViewer"
                component={DatabaseViewerScreen}
                options={{ title: 'Local Database' }}
            />
            <Stack.Screen
                name="RecentRegistrations"
                component={RecentRegistrationsScreen}
                options={{ title: 'Newly Added' }}
            />
            <Stack.Screen
                name="Export"
                component={ExportScreen}
                options={{ title: 'Export Data' }}
            />
            <Stack.Screen
                name="Import"
                component={ImportScreen}
                options={{ title: 'Import Data' }}
            />
            <Stack.Screen
                name="Search"
                component={SearchScreen}
                options={{ title: 'Search Participants', headerShown: false }}
            />
            <Stack.Screen
                name="TeamScannerSetup"
                component={TeamScannerLauncher}
                options={{ title: 'Team Setup' }}
            />
        </Stack.Navigator >
    );
};

export default AppNavigator;