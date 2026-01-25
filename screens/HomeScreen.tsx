import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Alert, Dimensions, Animated, Easing, Modal, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useEventContext } from '../navigation/EventContext';
import { syncFromFirebase, syncOnspotToFirebase } from '../services/SyncService';
import { logoutAdmin } from '../services/firebase';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

type Props = {
    navigation: HomeScreenNavigationProp;
};

const { width } = Dimensions.get('window');

const HomeScreen: React.FC<Props> = ({ navigation }) => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [syncing, setSyncing] = React.useState(false);

    // Verification Modal State
    const [showVerifyModal, setShowVerifyModal] = React.useState(false);
    const [verifyMode, setVerifyMode] = React.useState<'INDIVIDUAL' | 'TEAM'>('INDIVIDUAL');
    const [teamSize, setTeamSize] = React.useState(3);

    const slideAnim = React.useRef(new Animated.Value(-width * 0.75)).current;
    const { eventContext, setEventContext } = useEventContext();

    const toggleMenu = () => {
        const toValue = isMenuOpen ? -width * 0.75 : 0;
        Animated.timing(slideAnim, {
            toValue,
            duration: 300,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
        }).start();
        setIsMenuOpen(!isMenuOpen);
    };

    const closeMenu = () => {
        if (isMenuOpen) toggleMenu();
    };

    const handleSync = async () => {
        closeMenu();
        if (syncing) return;

        setSyncing(true);
        try {
            // 1. Pull latest data
            await syncFromFirebase();

            // 2. Push offline records
            const uploadedCount = await syncOnspotToFirebase();

            Alert.alert("Sync Complete", `Data updated.\nUploaded ${uploadedCount} on-spot registrations.`);
        } catch (error) {
            Alert.alert("Sync Error", "Failed to sync with server. Check internet connection.");
        } finally {
            setSyncing(false);
        }
    };

    const handleLogout = async () => {
        closeMenu();
        Alert.alert(
            "Logout",
            "Are you sure you want to logout?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await logoutAdmin();
                            setEventContext(null);
                            navigation.replace('Login');
                        } catch (error) {
                            Alert.alert("Error", "Failed to logout");
                        }
                    }
                }
            ]
        );
    };

    const handleNewRegister = () => {
        closeMenu();
        navigation.navigate('Registration');
    };

    const handleVerifyEnrollment = () => {
        closeMenu();
        // navigation.navigate('QRScanner'); // OLD
        setShowVerifyModal(true);
    };

    const handleStartScanning = () => {
        setShowVerifyModal(false);
        if (verifyMode === 'TEAM') {
            navigation.navigate('TeamScannerSetup');
        } else {
            navigation.navigate('QRScanner', {
                mode: 'INDIVIDUAL',
                teamSize: 1
            });
        }
    };

    const handleViewDatabase = () => {
        closeMenu();
        // Restrict access to specific admin account
        const allowedEmail = 'admin@zorphix.com';

        if (eventContext?.adminEmail === allowedEmail) {
            navigation.navigate('DatabaseViewer');
        } else {
            Alert.alert('Access Denied', 'This feature is restricted to the main administrator only.');
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />

            {/* Header with Menu Button */}
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={toggleMenu} style={styles.menuButton}>
                        <MaterialCommunityIcons name="menu" size={28} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>ZORPHIX</Text>
                </View>
                <TouchableOpacity onPress={handleSync} style={styles.syncButton} disabled={syncing}>
                    {syncing ? (
                        <ActivityIndicator size="small" color="#FFD700" />
                    ) : (
                        <MaterialCommunityIcons name="sync" size={24} color="#FFD700" />
                    )}
                </TouchableOpacity>
            </View>

            {/* Main Content */}
            <TouchableOpacity activeOpacity={1} onPress={closeMenu} style={styles.mainContent}>
                {/* Current Event Badge */}
                <View style={styles.eventBadge}>
                    <Text style={styles.eventLabel}>Managing Event</Text>
                    <Text style={styles.eventName}>{eventContext?.eventName || 'No Event'}</Text>
                    <Text style={styles.adminEmail}>{eventContext?.adminEmail}</Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={handleNewRegister}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="account-plus" size={32} color="#ffffffff" style={{ marginBottom: 10 }} />
                        <Text style={styles.actionTitle}>CREATE USER</Text>
                        <Text style={styles.actionSubtitle}>Onspot</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, styles.verifyButton]}
                        onPress={handleVerifyEnrollment}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="qrcode-scan" size={32} color="#000" style={{ marginBottom: 10 }} />
                        <Text style={[styles.actionTitle, styles.verifyTitle]}>VERIFY ENROLLMENT</Text>
                        <Text style={[styles.actionSubtitle, styles.verifySubtitle]}>Enroll Now</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>

            {/* Side Dashboard (Menu) */}
            <Animated.View style={[
                styles.sideMenu,
                { transform: [{ translateX: slideAnim }] }
            ]}>
                <View style={styles.menuHeader}>
                    <Text style={styles.menuTitle}>Dashboard</Text>
                </View>

                <TouchableOpacity style={styles.menuItem} onPress={handleViewDatabase}>
                    <MaterialCommunityIcons name="database" size={24} color="#FFF" style={{ marginRight: 15 }} />
                    <Text style={styles.menuItemText}>View Full Database</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => { closeMenu(); navigation.navigate('RecentRegistrations'); }}>
                    <MaterialCommunityIcons name="clipboard-account" size={24} color="#ffffffff" style={{ marginRight: 15 }} />
                    <Text style={[styles.menuItemText, { color: '#ffffffff' }]}>Onspot Students</Text>
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity style={styles.menuItem} onPress={() => { closeMenu(); navigation.navigate('Export'); }}>
                    <MaterialCommunityIcons name="file-export" size={24} color="#FFF" style={{ marginRight: 15 }} />
                    <Text style={styles.menuItemText}>Export Data</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => { closeMenu(); navigation.navigate('Import'); }}>
                    <MaterialCommunityIcons name="file-import" size={24} color="#FFF" style={{ marginRight: 15 }} />
                    <Text style={styles.menuItemText}>Import Data</Text>
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity style={styles.menuItem} onPress={handleSync}>
                    <MaterialCommunityIcons name="sync" size={24} color="#FFF" style={{ marginRight: 15 }} />
                    <Text style={styles.menuItemText}>Sync with Server</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                    <MaterialCommunityIcons name="logout" size={24} color="#FF6B6B" style={{ marginRight: 15 }} />
                    <Text style={[styles.menuItemText, { color: '#FF6B6B' }]}>Logout</Text>
                </TouchableOpacity>
            </Animated.View>

            {/* Overlay for closing menu when open */}
            {isMenuOpen && (
                <TouchableOpacity style={styles.overlay} onPress={toggleMenu} activeOpacity={1} />
            )}

            {/* Verification Mode Modal */}
            <Modal
                visible={showVerifyModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowVerifyModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.verifyModalContent}>
                        <Text style={styles.verifyModalTitle}>Select Verification Mode</Text>

                        {/* Mode Segmented Control */}
                        <View style={styles.segmentContainer}>
                            <TouchableOpacity
                                style={[styles.segmentButton, verifyMode === 'INDIVIDUAL' && styles.segmentActive]}
                                onPress={() => setVerifyMode('INDIVIDUAL')}
                            >
                                <Text style={[styles.segmentText, verifyMode === 'INDIVIDUAL' && styles.segmentTextActive]}>Individual</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.segmentButton, verifyMode === 'TEAM' && styles.segmentActive]}
                                onPress={() => setVerifyMode('TEAM')}
                            >
                                <Text style={[styles.segmentText, verifyMode === 'TEAM' && styles.segmentTextActive]}>Team</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Team Info Text */}
                        {verifyMode === 'TEAM' && (
                            <Text style={{ color: '#888', textAlign: 'center', marginBottom: 20 }}>
                                You will be asked to enter Team Name and Size in the next screen.
                            </Text>
                        )}

                        <View style={styles.verifyActionButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalBtnCancel]}
                                onPress={() => setShowVerifyModal(false)}
                            >
                                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalBtnConfirm]}
                                onPress={handleStartScanning}
                            >
                                <Text style={styles.modalBtnTextConfirm}>Start Scanning</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20,
        backgroundColor: '#000',
        borderBottomWidth: 1,
        borderBottomColor: '#222'
    },
    headerTitle: {
        color: '#FFD700',
        fontSize: 20,
        fontWeight: 'bold',
        marginLeft: 20,
        letterSpacing: 2
    },
    menuButton: {
        padding: 5
    },
    syncButton: {
        padding: 5,
    },
    syncIcon: {
        fontSize: 24,
    },
    syncingIcon: {
        opacity: 0.5,
    },
    menuLine: {
        width: 25,
        height: 3,
        backgroundColor: '#FFF',
        marginBottom: 5,
        borderRadius: 2
    },
    mainContent: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    eventBadge: {
        backgroundColor: '#111',
        borderRadius: 16,
        padding: 24,
        marginBottom: 40,
        borderWidth: 2,
        borderColor: '#FFD700',
        alignItems: 'center',
    },
    eventLabel: {
        fontSize: 12,
        color: '#ffffffff',
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 8,
    },
    eventName: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFD700',
        textAlign: 'center',
    },
    adminEmail: {
        fontSize: 12,
        color: '#ffffffff',
        marginTop: 8,
    },
    buttonContainer: {
        gap: 20,
    },
    actionButton: {
        backgroundColor: '#111',
        borderRadius: 16,
        padding: 30,
        borderWidth: 2,
        borderColor: '#333',
        alignItems: 'center',
    },
    verifyButton: {
        backgroundColor: '#FFD700',
        borderColor: '#FFD700',
    },
    actionIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    actionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFD700',
        letterSpacing: 1,
    },
    verifyTitle: {
        color: '#000',
    },
    actionSubtitle: {
        fontSize: 14,
        color: '#ffffffff',
        marginTop: 4,
    },
    verifySubtitle: {
        color: '#000000ff',
    },

    // Side Menu Styles
    sideMenu: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: width * 0.75,
        backgroundColor: '#111',
        zIndex: 100,
        paddingTop: 60,
        paddingHorizontal: 20,
        borderRightWidth: 1,
        borderRightColor: '#333',
        shadowColor: "#000",
        shadowOffset: { width: 5, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10
    },
    menuHeader: {
        marginBottom: 40,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        paddingBottom: 20
    },
    menuTitle: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: 'bold'
    },
    menuItem: {
        paddingVertical: 15,
        marginBottom: 10
    },
    menuItemText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '500'
    },
    divider: {
        height: 1,
        backgroundColor: '#333',
        marginVertical: 20
    },
    overlay: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 90
    },
    // Verification Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    verifyModalContent: {
        backgroundColor: '#1E1E1E',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        borderWidth: 1,
        borderColor: '#333'
    },
    verifyModalTitle: {
        color: '#FFD700',
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 24
    },
    segmentContainer: {
        flexDirection: 'row',
        backgroundColor: '#333',
        borderRadius: 12,
        padding: 4,
        marginBottom: 24
    },
    segmentButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 8
    },
    segmentActive: {
        backgroundColor: '#FFD700'
    },
    segmentText: {
        color: '#888',
        fontWeight: '600'
    },
    segmentTextActive: {
        color: '#000',
        fontWeight: 'bold'
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 30,
        paddingHorizontal: 10
    },
    stepperLabel: {
        color: '#FFF',
        fontSize: 16
    },
    stepperControls: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#333',
        borderRadius: 12,
    },
    stepperButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepperBtnText: {
        color: '#FFD700',
        fontSize: 24,
        fontWeight: 'bold'
    },
    stepperValue: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        width: 40,
        textAlign: 'center'
    },
    verifyActionButtons: {
        flexDirection: 'row',
        gap: 12
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center'
    },
    modalBtnCancel: {
        backgroundColor: '#333'
    },
    modalBtnConfirm: {
        backgroundColor: '#FFD700'
    },
    modalBtnTextCancel: {
        color: '#FFF',
        fontWeight: 'bold'
    },
    modalBtnTextConfirm: {
        color: '#000',
        fontWeight: 'bold'
    }
});

export default HomeScreen;
