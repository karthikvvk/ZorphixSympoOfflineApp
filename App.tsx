import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import { registerRootComponent } from 'expo';

function App() {
    return (
        <NavigationContainer>
            <AppNavigator />
            <StatusBar style="auto" />
        </NavigationContainer>
    );
}

export default App;

registerRootComponent(App);
