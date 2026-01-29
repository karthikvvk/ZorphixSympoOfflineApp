import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image, Alert, StatusBar, ScrollView, ActivityIndicator } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useEventContext } from '../navigation/EventContext';
import { loginAdmin, getAdminEventMapping } from '../services/firebase';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

type Props = {
    navigation: LoginScreenNavigationProp;
};

const LoginScreen: React.FC<Props> = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { eventContext, setEventContext, isLoading } = useEventContext();

    // Auto-navigate to Home if session exists
    useEffect(() => {
        if (!isLoading && eventContext) {
            // console.log('🔄 [LoginScreen] Auto-login: Session found, navigating to Home');
            navigation.replace('Home');
        } else if (!isLoading && !eventContext) {
            // console.log('ℹ️ [LoginScreen] No active session found. Staying on Login screen.');
        }
    }, [isLoading, eventContext, navigation]);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password.');
            return;
        }

        setLoading(true);

        try {
            // Authenticate with Firebase
            // console.log(`🔐 [LoginScreen] Attempting login for: ${email}`);
            const user = await loginAdmin(email, password);
            // console.log('✅ [LoginScreen] Firebase Auth successful.');

            // Get the event mapped to this admin
            const eventName = await getAdminEventMapping(email);

            // Check if admin is valid (null means not found, '' means on-spot admin)
            if (eventName === null) {
                Alert.alert(
                    'Access Denied',
                    'Your account is not mapped to any event. Please contact the administrator.'
                );
                setLoading(false);
                return;
            }

            setEventContext({
                eventName: eventName,  // Can be '' for on-spot admin
                adminEmail: email
            });
            // console.log(`📝 [LoginScreen] Context set. Event: "${eventName}", Email: ${email}`);

            // console.log('🔑 [LoginScreen] Login successful. Navigating to Home...');
            // Navigate to home
            navigation.replace('Home');
        } catch (error: any) {
            console.error('Login error:', error);

            let errorMessage = 'Login failed. Please try again.';
            if (error.code === 'auth/user-not-found') {
                errorMessage = 'No account found with this email.';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = 'Incorrect password.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email format.';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = 'Network error. Please check your connection.';
            }

            Alert.alert('Login Error', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.contentContainer}>
                        <View style={styles.formContainer}>
                            <View style={styles.logoContainer}>
                                <Image
                                    source={require('../assets/applogo.png')}
                                    style={styles.logo}
                                    resizeMode="contain"
                                />
                            </View>
                            <Text style={styles.title}>Event Admin Login</Text>
                            <Text style={styles.subtitle}>Login with your assigned event email</Text>

                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Email</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter admin email"
                                    placeholderTextColor="#666"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    editable={!loading}
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
                                        editable={!loading}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowPassword(!showPassword)}
                                        style={styles.eyeIcon}
                                        disabled={loading}
                                    >
                                        <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[styles.button, loading && styles.buttonDisabled]}
                                onPress={handleLogin}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#000" />
                                ) : (
                                    <Text style={styles.buttonText}>LOGIN</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
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
    contentContainer: {
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
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#888',
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
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#000',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
});

export default LoginScreen;