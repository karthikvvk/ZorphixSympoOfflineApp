import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, StatusBar, Alert, Dimensions, Animated, Easing } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, Event } from '../navigation/types';
import { syncFromFirebase, syncOnspotToFirebase } from '../services/SyncService';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

type Props = {
    navigation: HomeScreenNavigationProp;
};



const DUMMY_EVENTS: Event[] = [
    {
        id: '1',
        title: 'Pixel Reforge',
        category: 'Non-Technical',
        date: 'Oct 24, 2025',
        description: ''
    },
    {
        id: '2',
        title: 'PromptCraft',
        category: 'Technical',
        date: 'Oct 25, 2025',
        description: ''
    },
    {
        id: '3',
        title: 'AlgoPulse',
        category: 'Technical',
        date: 'Oct 24, 2025',
        description: ''
    },
    {
        id: '4',
        title: 'CodeBack',
        category: 'Technical',
        date: 'Oct 26, 2025',
        description: ''
    },
    {
        id: '5',
        title: 'Sip to Survive',
        category: 'Non-Technical',
        date: 'Oct 25, 2025',
        description: ''
    },
    {
        id: '6',
        title: 'CodeCrypt',
        category: 'Technical',
        date: 'Oct 26, 2025',
        description: ''
    },
    {
        id: '7',
        title: 'LinkLogic',
        category: 'Technical',
        date: 'Oct 26, 2025',
        description: ''
    },
];

const { width, height } = Dimensions.get('window');

const HomeScreen: React.FC<Props> = ({ navigation }) => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const slideAnim = React.useRef(new Animated.Value(-width * 0.75)).current; // Start hidden (left)

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

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'Technical': return '#B8860B'; // Dark Golden Rod
            case 'Workshop': return '#DAA520'; // Golden Rod
            case 'Non-Technical': return '#FFD700'; // Gold
            default: return '#95a5a6';
        }
    };

    const handleSync = async () => {
        closeMenu();
        try {
            // 1. Pull latest data
            await syncFromFirebase();

            // 2. Push offline records
            const uploadedCount = await syncOnspotToFirebase();

            Alert.alert("Sync Complete", `Data updated.\nUploaded ${uploadedCount} on-spot registrations.`);
        } catch (error) {
            Alert.alert("Sync Error", "Failed to sync with server. Check internet connection.");
        }
    };

    const renderEventItem = ({ item }: { item: Event }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => { closeMenu(); navigation.navigate('EventDetail', { event: item }); }}
            activeOpacity={0.9}
        >
            <View style={styles.cardHeader}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <View style={[styles.badge, { borderColor: getCategoryColor(item.category) }]}>
                    <Text style={[styles.badgeText, { color: getCategoryColor(item.category) }]}>{item.category}</Text>
                </View>
            </View>
            <Text style={styles.eventDate}>{item.date}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />

            {/* Header with Menu Button */}
            <View style={styles.header}>
                <TouchableOpacity onPress={toggleMenu} style={styles.menuButton}>
                    <View style={styles.menuLine} />
                    <View style={styles.menuLine} />
                    <View style={styles.menuLine} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>ZORPHIX</Text>
            </View>

            {/* Main Content */}
            <TouchableOpacity activeOpacity={1} onPress={closeMenu} style={{ flex: 1 }}>
                <FlatList
                    data={DUMMY_EVENTS}
                    renderItem={renderEventItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={true}
                    persistentScrollbar={true}
                    indicatorStyle="white"
                />
            </TouchableOpacity>

            {/* Side Dashboard (Menu) */}
            <Animated.View style={[
                styles.sideMenu,
                { transform: [{ translateX: slideAnim }] }
            ]}>
                <View style={styles.menuHeader}>
                    <Text style={styles.menuTitle}>Dashboard</Text>
                </View>

                <TouchableOpacity style={styles.menuItem} onPress={() => { closeMenu(); navigation.navigate('DatabaseViewer'); }}>
                    <Text style={styles.menuItemText}>📂  View Full Database</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => { closeMenu(); navigation.navigate('RecentRegistrations'); }}>
                    <Text style={[styles.menuItemText, { color: '#FFD700' }]}>🆕  Newly Added Students</Text>
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity style={styles.menuItem} onPress={handleSync}>
                    <Text style={styles.menuItemText}>🔄  Sync Data</Text>
                </TouchableOpacity>
            </Animated.View>

            {/* Overlay for closing menu when open */}
            {isMenuOpen && (
                <TouchableOpacity style={styles.overlay} onPress={toggleMenu} activeOpacity={1} />
            )}
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
        paddingHorizontal: 20,
        paddingTop: 50, // Safe area top
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
    menuLine: {
        width: 25,
        height: 3,
        backgroundColor: '#FFF',
        marginBottom: 5,
        borderRadius: 2
    },
    listContent: {
        padding: 16,
    },
    card: {
        backgroundColor: '#111',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#333',
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    eventTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFF',
        flex: 1,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        marginLeft: 10,
        borderWidth: 1,
        backgroundColor: 'transparent'
    },
    badgeText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    eventDate: {
        fontSize: 14,
        color: '#888',
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
    }
});

export default HomeScreen;
