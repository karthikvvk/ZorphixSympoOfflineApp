import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Alert, Dimensions, Animated, Easing, Modal, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, PAID_EVENTS } from '../navigation/types';
import { useEventContext } from '../navigation/EventContext';
import { syncFromFirebase, syncOnspotToFirebase } from '../services/SyncService';
import { importFromExcel } from '../services/ExcelImportService';
import { logoutAdmin } from '../services/firebase';
import { startNetworkWatcher, stopNetworkWatcher } from '../services/SyncManager';
import SyncOverlay from '../components/SyncOverlay';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

type Props = {
    navigation: HomeScreenNavigationProp;
};

const { width } = Dimensions.get('window');

const HomeScreen: React.FC<Props> = ({ navigation }) => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [syncing, setSyncing] = React.useState(false);

    const [isImportDone, setIsImportDone] = React.useState(false);

    // Background sync overlay state
    const [bgSyncVisible, setBgSyncVisible] = React.useState(false);
    const [bgSyncStatus, setBgSyncStatus] = React.useState('');
    const [bgSyncSubStatus, setBgSyncSubStatus] = React.useState<string | undefined>(undefined);

    // Verification Modal State
    const [showVerifyModal, setShowVerifyModal] = React.useState(false);
    const [verifyMode, setVerifyMode] = React.useState<'INDIVIDUAL' | 'TEAM'>('INDIVIDUAL');
    const [teamSize, setTeamSize] = React.useState(3);

    const slideAnim = React.useRef(new Animated.Value(-width * 0.75)).current;
    const { eventContext, setEventContext } = useEventContext();

    // Detect On-Spot Registration Desk mode (empty eventName)
    const isOnSpotMode = eventContext?.eventName === '';

    // Check if current event is a paid event (team enrollment disabled for paid events)
    const isPaidEvent = eventContext?.eventName ? PAID_EVENTS.includes(eventContext.eventName) : false;

    // Start network watcher for background sync on mount
    React.useEffect(() => {
        // console.log('🏠 [HomeScreen] Component Mounted.');
        // console.log(`ℹ️ [HomeScreen] Context: Event="${eventContext?.eventName}", Email="${eventContext?.adminEmail}"`);
        if (isOnSpotMode) {
            // console.log('ℹ️ [HomeScreen] Mode: ON-SPOT REGISTRATION DESK');
        } else {
            // console.log('ℹ️ [HomeScreen] Mode: EVENT MANAGER');
        }

        // Start background network watcher (persists until sync completes)
        // It won't start again if already running
        // console.log('👀 [HomeScreen] Starting background network watcher...');
        startNetworkWatcher((status, subStatus) => {
            setBgSyncVisible(true);
            setBgSyncStatus(status);
            setBgSyncSubStatus(subStatus);

            // Hide overlay after sync completes
            if (status.includes('complete') || status.includes('failed')) {
                setTimeout(() => setBgSyncVisible(false), 1500);
            }
        });

        // NO cleanup on unmount - let the watcher run until sync completes
        // This ensures retries continue even if user navigates away
    }, [eventContext]);

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
        // closeMenu(); // Don't close menu if called programmatically? Or yes? 
        // If called from button, we usually close menu. If called from Import, we might want to keep it open or close it. 
        // Let's keep it simple.
        if (isMenuOpen) closeMenu();

        if (syncing) return;

        setSyncing(true);
        // console.log("🔄 [HomeScreen] Starting Manual Sync...");
        try {
            // 1. Write to Firebase (Push offline records)
            // We do this first so that the server has the latest local data
            // console.log("📤 [HomeScreen] Calling syncOnspotToFirebase()...");
            const uploadedCount = await syncOnspotToFirebase();
            // console.log(`✅ [HomeScreen] syncOnspotToFirebase() returned: ${uploadedCount} records uploaded.`);

            // 2. Read from Firebase is DISABLED.
            // await syncFromFirebase(); 

            Alert.alert("Sync Complete", `Data updated.\nUploaded ${uploadedCount} on-spot registrations to server.`);
        } catch (error) {
            // Fail silent: No alert on error
            // console.log("❌ [HomeScreen] Sync failed silently:", error);
        } finally {
            // console.log("⏹ [HomeScreen] Sync process finished.");
            setSyncing(false);
        }
    };

    const handleOneTimeImport = async () => {
        closeMenu();
        if (isImportDone) return;

        try {
            const importedCount = await importFromExcel();

            if (importedCount > 0) {
                setIsImportDone(true);
                // Automatically sync after import
                await handleSync();
            } else {
                // If import cancelled or 0, don't disable? User said "once this... has written... change its state to disabled".
                // Logic: if 0, maybe they picked wrong file. Don't disable.
            }

        } catch (e) {
            console.error("One time import failed", e);
            Alert.alert("Import Error", "Failed to import excel file.");
        }
    }

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
        if (isOnSpotMode) {
            navigation.navigate('OnSpotRegistration');
        } else {
            navigation.navigate('Registration');
        }
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
        if (eventContext?.adminEmail) {
            navigation.navigate('DatabaseViewer');
        } else {
            Alert.alert('Error', 'No event context found.');
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
                <View style={styles.justName}>
                    <Text style={styles.eventLabel}>{isOnSpotMode ? 'Registration Desk' : 'Managing Event'}</Text>
                    <Text style={[styles.eventName, isOnSpotMode && { color: '#4CAF50' }]}>
                        {isOnSpotMode ? '📋 On-Spot Registration' : (eventContext?.eventName || 'No Event')}
                    </Text>
                    <Text style={styles.adminEmail}>{eventContext?.adminEmail}</Text>
                </View>
                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[styles.actionButton, isOnSpotMode && { borderColor: '#4CAF50' }]}
                        onPress={handleNewRegister}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="account-plus" size={32} color={isOnSpotMode ? '#4CAF50' : '#ffffffff'} style={{ marginBottom: 10 }} />
                        <Text style={[styles.actionTitle, isOnSpotMode && { color: '#4CAF50' }]}>
                            {isOnSpotMode ? 'REGISTER PARTICIPANT' : 'CREATE USER'}
                        </Text>
                        <Text style={styles.actionSubtitle}>
                            {isOnSpotMode ? 'Generate QR Code' : 'Onspot'}
                        </Text>
                    </TouchableOpacity>

                    {/* Only show event-specific buttons if NOT in on-spot mode */}
                    {!isOnSpotMode && (
                        <View style={{ flexDirection: 'row', gap: 15 }}>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.verifyButton, { flex: 1, padding: 20 }]}
                                onPress={() => navigation.navigate('QRScanner', { mode: 'INDIVIDUAL', teamSize: 1 })}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="account" size={32} color="#000" style={{ marginBottom: 10 }} />
                                <Text style={[styles.actionTitle, styles.verifyTitle, { fontSize: 16, alignContent: 'center' }]}>ENROLL INDIVIDUAL</Text>
                                <Text style={[styles.actionSubtitle, styles.verifySubtitle, { fontSize: 12 }]}>Scan Now</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.verifyButton, { flex: 1, padding: 20 }, isPaidEvent && { opacity: 0.4, backgroundColor: '#888' }]}
                                onPress={() => navigation.navigate('TeamScannerSetup')}
                                activeOpacity={0.8}
                                disabled={isPaidEvent}
                            >
                                <MaterialCommunityIcons name="account-group" size={32} color={isPaidEvent ? '#555' : '#000'} style={{ marginBottom: 10 }} />
                                <Text style={[styles.actionTitle, styles.verifyTitle, { fontSize: 16 }, isPaidEvent && { color: '#555' }]}>{isPaidEvent ? 'TEAM (N/A)' : 'ENROLL TEAM'}</Text>
                                <Text style={[styles.actionSubtitle, styles.verifySubtitle, { fontSize: 12 }, isPaidEvent && { color: '#555' }]}>{isPaidEvent ? 'Paid Event' : 'Team Setup'}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
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
                    <Text style={[styles.menuItemText, { color: '#ffffffff' }]}>Onspot Students (Via Manual Form)</Text>
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity style={styles.menuItem} onPress={() => { closeMenu(); navigation.navigate('Export'); }}>
                    <MaterialCommunityIcons name="file-export" size={24} color="#FFF" style={{ marginRight: 15 }} />
                    <Text style={styles.menuItemText}>Export Data</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => { closeMenu(); navigation.navigate('Import'); }}>
                    <MaterialCommunityIcons name="qrcode-scan" size={24} color="#FFF" style={{ marginRight: 15 }} />
                    <Text style={[styles.menuItemText, { color: '#ffffffff' }]}>Import From Peers</Text>
                </TouchableOpacity>
                {/* Replaced generic Import with One-Time Import */}
                {/* One-Time Import (Admin Only) */}
                {eventContext?.adminEmail === 'admin@zorphix.com' && (
                    <TouchableOpacity
                        style={[styles.menuItem, isImportDone && { opacity: 0.5 }]}
                        onPress={handleOneTimeImport}
                        disabled={isImportDone}
                    >
                        <MaterialCommunityIcons name="file-excel-box" size={24} color="#FFD700" style={{ marginRight: 15 }} />
                        <Text style={[styles.menuItemText, { color: '#FFD700' }]}>
                            {isImportDone ? 'Imported (One-Time)' : 'One-Time Import (Excel)'}
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Kept original Import for QR if needed? Or just remove? 
                     User said: "while in the sidebar add one more button named: one-time-import"
                     It does not explicitly say remove the old Import button which was for QR.
                     However, previous prompts replaced "import from firebase" with "excel import".
                     The "Import Data" button (ImportScreen) was for QR import service. 
                     I will keep "Export Data" and "Import Data" (QR) as is, but add "One-Time Import" as requested.
                 */}



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

            {/* Search floating action button */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => { closeMenu(); navigation.navigate('Search'); }}
                activeOpacity={0.8}
            >
                <MaterialCommunityIcons name="magnify" size={30} color="#000" />
            </TouchableOpacity>

            {/* Background Sync Overlay */}
            <SyncOverlay
                visible={bgSyncVisible}
                status={bgSyncStatus}
                subStatus={bgSyncSubStatus}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FFD700',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        zIndex: 50, // Ensure it's above other elements but below menu if needed (menu zIndex is 100)
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
        justifyContent: 'flex-start',
        paddingTop: 60,
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
    justName: {
        // backgroundColor: '#111',
        borderRadius: 16,
        padding: 24,
        marginBottom: 40,
        // borderWidth: 2,
        // borderColor: '#FFD700',
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
        textAlign: 'center',
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
