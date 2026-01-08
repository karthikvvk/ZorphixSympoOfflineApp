import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image, Alert, StatusBar, ScrollView } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

type Props = {
    navigation: LoginScreenNavigationProp;
};

const LoginScreen: React.FC<Props> = ({ navigation }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = () => {
        if (!username || !password) {
            Alert.alert('Error', 'Please enter both username and password.');
            return;
        }

        // Hardcoded credentials as requested
        if (username === 'admin' && password === 'zorphix') {
            navigation.replace('Home');
        } else {
            Alert.alert('Error', 'Invalid credentials. Please try again.');
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.keyboardView}
                >
                    <View style={styles.formContainer}>
                        <View style={styles.logoContainer}>
                            <Image
                                source={require('../assets/zorphix-logo.png')}
                                style={styles.logo}
                                resizeMode="contain"
                            />
                        </View>
                        <Text style={styles.title}>Zorphix Login</Text>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Username</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter username"
                                placeholderTextColor="#666"
                                value={username}
                                onChangeText={setUsername}
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Password</Text>
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    style={styles.passwordInput}
                                    placeholder="Enter password"
                                    placeholderTextColor="#666"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                                    <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.button} onPress={handleLogin}>
                            <Text style={styles.buttonText}>LOGIN</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        minHeight: '100%',
    },
    keyboardView: {
        width: '100%',
        maxWidth: 450,
        alignItems: 'center',
    },
    formContainer: {
        width: '100%',
        backgroundColor: '#111',
        padding: 30,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: '#FFD700',
        ...Platform.select({
            ios: {
                shadowColor: '#FFD700',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 15,
            },
            android: {
                elevation: 8,
            },
            web: {
                boxShadow: '0px 4px 20px rgba(255, 215, 0, 0.3)',
            },
        }),
    },
    logoContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    logo: {
        width: 100,
        height: 100,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFD700',
        marginBottom: 30,
        textAlign: 'center',
    },
    inputContainer: {
        marginBottom: 20,
        width: '100%',
    },
    label: {
        fontSize: 14,
        color: '#FFD700',
        marginBottom: 8,
        fontWeight: '600',
    },
    input: {
        width: '100%',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        padding: 14,
        fontSize: 16,
        backgroundColor: '#000',
        color: 'white',
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        backgroundColor: '#000',
        width: '100%',
    },
    passwordInput: {
        flex: 1,
        padding: 14,
        fontSize: 16,
        color: 'white',
    },
    eyeIcon: {
        paddingHorizontal: 15,
        paddingVertical: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    eyeText: {
        color: '#FFD700',
        fontSize: 14,
        fontWeight: '600',
    },
    button: {
        width: '100%',
        backgroundColor: '#FFD700',
        paddingVertical: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        ...Platform.select({
            ios: {
                shadowColor: '#FFD700',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
            web: {
                boxShadow: '0px 2px 8px rgba(255, 215, 0, 0.4)',
                cursor: 'pointer',
            },
        }),
    },
    buttonText: {
        color: '#000',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
});

export default LoginScreen;