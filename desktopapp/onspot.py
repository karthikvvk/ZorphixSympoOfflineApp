import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import sqlite3
import qrcode
from PIL import Image, ImageTk
import json
import time
import csv
import os

# ================= CONFIG =================

APP_TITLE = "Zorphix • On-Spot Registration"
WINDOW_SIZE = "600x750"

LOGIN_EMAIL = "onspot@zorphix.com"
LOGIN_PASSWORD = "onspotOs3Fk@zorphix@2026"

DB_FILE = "onspot_participants.db"
BACKUP_FILE = "onspot_backup.csv"
LOGIN_FLAG = ".login"

# ================= COLORS =================

COLORS = {
    "bg_dark": "#0a0a0a",
    "bg_card": "#1a1a1a",
    "bg_input": "#252525",
    "bg_input_hover": "#2d2d2d",
    "bg_button": "#4CAF50",
    "bg_button_hover": "#45a049",
    "bg_secondary": "#2d2d2d",
    "text_primary": "#ffffff",
    "text_secondary": "#b0b0b0",
    "text_muted": "#707070",
    "accent": "#4CAF50",
    "accent_gold": "#FFD700",
    "border": "#333333",
}

# ================= DATABASE =================

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT UNIQUE,
            name TEXT,
            email TEXT,
            phone TEXT,
            college TEXT,
            dept TEXT,
            year TEXT,
            created_at TEXT
        )
    """)
    
    # Check existing columns and add missing ones
    cur.execute("PRAGMA table_info(participants)")
    columns = [column[1] for column in cur.fetchall()]
    
    # Add missing columns if they don't exist
    if 'college' not in columns:
        cur.execute("ALTER TABLE participants ADD COLUMN college TEXT DEFAULT ''")
        print("Added 'college' column to database")
    
    if 'dept' not in columns:
        cur.execute("ALTER TABLE participants ADD COLUMN dept TEXT DEFAULT ''")
        print("Added 'dept' column to database")
    
    if 'year' not in columns:
        cur.execute("ALTER TABLE participants ADD COLUMN year TEXT DEFAULT ''")
        print("Added 'year' column to database")
    
    conn.commit()
    conn.close()
    print("Database initialized successfully")

def insert_participant(payload):
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    
    try:
        cur.execute("""
            INSERT INTO participants 
            (uid, name, email, phone, college, dept, year, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        """, (
            payload["uid"],
            payload["name"],
            payload["email"],
            payload["phone"],
            payload.get("college", ""),
            payload.get("dept", ""),
            payload.get("year", "")
        ))
        conn.commit()
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        raise
    finally:
        conn.close()

def participant_exists(email, phone):
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute(
        "SELECT uid FROM participants WHERE email = ? OR phone = ?",
        (email, phone)
    )
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None

def fetch_all():
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    
    # Check which columns exist
    cur.execute("PRAGMA table_info(participants)")
    columns = [column[1] for column in cur.fetchall()]
    
    # Build query based on available columns
    select_cols = ["uid", "name", "email", "phone"]
    if "college" in columns:
        select_cols.append("college")
    if "dept" in columns:
        select_cols.append("dept")
    if "year" in columns:
        select_cols.append("year")
    select_cols.append("created_at")
    
    query = f"SELECT {', '.join(select_cols)} FROM participants ORDER BY created_at DESC"
    cur.execute(query)
    rows = cur.fetchall()
    conn.close()
    
    # Pad rows if columns are missing
    padded_rows = []
    for row in rows:
        row_list = list(row)
        # Ensure we have 8 columns total
        while len(row_list) < 8:
            row_list.insert(-1, "")  # Insert empty string before created_at
        padded_rows.append(tuple(row_list))
    
    return padded_rows

def append_backup(payload):
    file_exists = os.path.exists(BACKUP_FILE)
    with open(BACKUP_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow([
                "uid", "name", "email", "phone",
                "college", "dept", "year", "created_at"
            ])
        writer.writerow([
            payload["uid"],
            payload["name"],
            payload["email"],
            payload["phone"],
            payload.get("college", ""),
            payload.get("dept", ""),
            payload.get("year", ""),
            time.strftime("%Y-%m-%d %H:%M:%S")
        ])

# ================= OPTIONS =================

DEGREE_OPTIONS = [
    "B.Tech", "B.E", "B.Sc", "B.Com", "B.Arch",
    "M.Tech", "M.E", "MBA", "MCA", "Other"
]

DEPARTMENT_OPTIONS = [
    "Artificial Intelligence and Data Science",
    "Biomedical Engineering",
    "Chemical Engineering",
    "Civil Engineering",
    "Computer Science and Business Systems",
    "Computer Science and Design",
    "Computer Science and Engineering",
    "CSE (Artificial Intelligence and Machine Learning)",
    "CSE (Cyber Security)",
    "Electrical and Electronics Engineering",
    "Electronics and Communication Engineering",
    "Mechanical Engineering",
    "Mechatronics Engineering",
    "Information Technology",
    "Other"
]



COLLEGE_OPTIONS = [

"University Departments of Anna University Chennai - CEG Campus" ,
"University Departments of Anna University Chennai - ACT Campus" ,
"School of Architecture and Planning Anna University" ,
"University Departments of Anna University Chennai - MIT Campus" ,
"Annamalai University Faculty of Engineering and Technology" ,
"Indian Institute of Information Technology Design & Manufacturing" ,
"Indian Institute of Information Technology Tiruchirappalli" ,
"Indian Institute of Technology Madras" ,
"National Institute of Technology, Tiruchppalli" ,
"Academy of Maritime Education and Training" ,
"Amrita Vishwa Vidyapeetham" ,
"Avinashilingam Institute for Home Science & Higher Education for Women" ,
"Bharath Institute of Higher Education & Research" ,
"Chennai Mathematical Institute" ,
"Chettinad Academy of Research and Education (CARE)" ,
"Dr. M.G.R. Educational and Research Institute" ,
"Hindustan Institute of Technology and Science (HITS)" ,
"Kalasalingam Academy of Research and Education" ,
"Karpagam Academy of Higher Education" ,
"Karunya Institute of Technology and Sciences" ,
"Meenakshi Academy of Higher Education and Research" ,
"Noorul Islam Centre for Higher Education" ,
"Periyar Maniammai Institute of Science & Technology" ,
"Ponnaiyah Ramajayam Institute of Science & technology (PMIST)" ,
"S.R.M. Institute of Science and Technology" ,
"Sathyabama Institute of Science and Technology" ,
"Saveetha Institute of Medical and Technical Sciences" ,
"Shanmugha Arts, SciencTechnoy & Research Academy (SASTRA)" ,
"Sri Chandrasekharandra Saraswati Vishwa Mahavidyalaya" ,
"Sri Ramachandra Institute of Higher Education and Research" ,
"St. Peter's Institute of Higher Education and Research" ,
"The Gandhigram Rural Institute" ,
"Vel Tech Rangarajan Dr Sagunthala R&D Institute of Science & Technology" ,
"Vellore Institute of Technology" ,
"Vels Institute of Science, Technoy & Advanced Studies (VISTAS)" ,
"Vinayaka Mission's Research Foundation" ,
"University College of Engineering Villupuram" ,
"University College of Engineering Tindivanam" ,
"University College of Engineering Arni" ,
"University College of Engineering Kancheepuram" ,
"Aalim Muhammed Salegh College of Engineering" ,
"Jaya Engineering College" ,
"Jaya Institute of Technology" ,
"Prathyusha Engineering college (Autonomous)" ,
"R M D Engineering College (Autonomous)" ,
"R M Engineering College (Autonomous)" ,
"S A Engineering College (Autonomous)" ,
"Sri Ram Engineering College" ,
"Sri Venkateswara College of Engineering and Technology" ,
"Vel Tech Multi Tech Dr. Rangarajan Dr. Sakunthala Engineering College (Autonomous)" ,
"Velammal Engineering College (Autonomous)" ,
"Sri Venkateswara Institute of Science and Technology" ,
"Vel Tech High Tech Dr. Rangarajan Dr. Sakunthala Engineering College (Autonomous)" ,
"Gojan School of Business and Technology" ,
"SAMS College of Engineering and Technology" ,
"PMR Engineering College" ,
"J N N Institute of Engineering (Autonomous)" ,
"St. Peters College of Engineering and Technology" ,
"R M K College of Engineering and Technology (Autonomous)" ,
"Annai Veilankannis College of Engineering" ,
"Annai Mira College of Engineering and Technology" ,
"Jeppiaar Institute of Technology" ,
"St. Joseph's Institute of Technology (Autonomous)" ,
"Sri Jayaram Institute of Engineering and Technology" ,
"D M I College of Engineering" ,
"Kings Engineering College" ,
"Pallavan College of Engineering" ,
"Panimalar Engineering College (Autonomous)" ,
"Rajalakshmi Engineering College (Autonomous)" ,
"Rajiv Gandhi College of Engineering" ,
"S K R Engineering College" ,
"Saveetha Engineering College (Autonomous)" ,
"Sree Sastha Institute of Engineering and Technology" ,
"Sri Muthukumaran Institute of Technology" ,
"Sri Venkateswara College of Engineering (Autonomous)" ,
"Jaya College of Engineering and Technology" ,
"P B College of Engineering" ,
"Loyola Institute of Technology" ,
"P T Lee Chengalvaraya Naicker College of Engineering and Technology" ,
"Alpha College of Engineering" ,
"Indira Institute of Engineering and Technology" ,
"Apollo Engineering College" ,
"A R M College of Engineering and Technology" ,
"Adhi College of Engineering and Technology" ,
"Jei Mathaajee College of Engineering" ,
"Velammal Institute of Technology" ,
"G R T Institute of Engineering and Technology" ,
"T J S Engineering College" ,
"Madha Institute of Engineering and Technology" ,
"Mohammed Sathak A J College of Engineering" ,
"Anand Institute of Higher Technology" ,
"Easwari Engineering College (Autonomous)" ,
"Jeppiaar Engineering College" ,
"Jerusalem College of Engineering (Autonomous)" ,
"Meenakshi Sundararajan Engineering College" ,
"Misrimal Navajee Munoth Jain Engineering College" ,
"K C G College of Technology (Autonomous)" ,
"Shree Motilal Kanhaiyalal (SMK) Fomra Institute of Technology" ,
"Sri Sivasubramaniya Nadar College of Engineering (Autonomous)" ,
"Agni College of Technology" ,
"St. Joseph's College of Engineering (Autonomous)" ,
"T.J Institute of Technology" ,
"Thangavelu Engineering College" ,
"Central Institute of Petrochemicals Engineering and Technology (CIPET)" ,
"Dhanalakshmi Srinivasan College of Engineering and Technology" ,
"Sri Sai Ram Institute of Technology (Autonomous)" ,
"St. Joseph College of Engineering" ,
"ARS College of Engineering" ,
"Sri Krishna Institute of Technology" ,
"Chennai Institute of Technology and Applied Research" ,
"Chennai Institute of Technology (Autonomous)" ,
"Adhiparasakthi Engineering College" ,
"Annai Teresa College of Engineering" ,
"Dhanalakshmi College of Engineering" ,
"G K M College of Engineering and Technology" ,
"I F E T College of Engineering (Autonomous)" ,
"Karpaga Vinayaga College of Engineering and Technology" ,
"Madha Engineering College" ,
"Mailam Engineering College" ,
"Sri Venkateswaraa College of Technology" ,
"Prince Shri Venkateshwara Padmavathy Engineering College (Autonomous)" ,
"T S M Jain College of Technology" ,
"Jaya Sakthi Engineering College" ,
"Sri Sai Ram Engineering College (Autonomous)" ,
"Tagore Engineering College" ,
"V R S College of Engineering and Technology" ,
"SRM Valliammai Engineering College (Autonomous)" ,
"Asan Memorial College of Engineering and Technology" ,
"Dhaanish Ahmed College of Engineering" ,
"Sri Ramanujar Engineering College" ,
"Sri Krishna Engineering College" ,
"E S College of Engineering and Technology" ,
"Maha Bharathi Engineering College" ,
"New Prince Shri Bhavani College of Engineering and Technology (Autonomous)" ,
"Rajalakshmi Institute of Technology (Autonomous)" ,
"Surya Group of Institutions" ,
"A R Engineering College" ,
"Rrase College of Engineering" ,
"Sree Krishna College of Engineering" ,
"A K T Memorial College of Engineering and Technology" ,
"Prince Dr. K Vasudevan College of Engineering and Technology" ,
"Chendu College of Engineering and Technology" ,
"Sri Rangapoopathi College of Engineering" ,
"Saraswathy College of Engineering and Technology" ,
"Loyola ICAM College of Engineering and Technology" ,
"PERI Institute of Technology" ,
"Adhiparasakthi College of Engineering" ,
"Arulmigu Meenakshi Amman College of Engineering" ,
"Arunai Engineering College" ,
"C Abdul Hakeem College of Engineering and Technology" ,
"Ganadipathy Tulsi's Jain Engineering College" ,
"Meenakshi College of Engineering" ,
"Priyadarshini Engineering College" ,
"Ranipettai Engineering College" ,
"S K P Engineering College" ,
"Sri Balaji Chockalingam Engineering College" ,
"Sri Nandhanam College of Engineering and Technology" ,
"Thanthai Periyar Government Institute of Technology" ,
"Thirumalai Engineering College" ,
"Thiruvalluvar College of Engineering and Technology" ,
"Bharathidasan Engineering College" ,
"Kingston Engineering College" ,
"Global Institute of Engineering and Technology" ,
"Annamalaiar College of Engineering" ,
"Podhigai College of Engineering and Technology" ,
"Sri Krishna College of Engineering" ,
"Oxford College of Engineering" ,
"Idhaya Engineering College for Women" ,
"Government College of Technology (Autonomous), Coimbae" ,
"PSG College of Technology (Autonomous)" ,
"Coimbatore Institute of Technology (Autonomous)" ,
"Anna University Regional Campus - Coimbatore" ,
"Sri Shanmugha College of Engineering and Technology" ,
"Muthayammal College of Engineering" ,
"N S N College of Engineering and Technology" ,
"K S R Institute for Engineering and Technology (Autonomous)" ,
"Rathinam Technical Campus (Autonomous)" ,
"Aishwarya College of Engineering and Technology" ,
"Asian College of Engineering and Technology" ,
"Ganesh College of Engineering" ,
"Sri Ranganathar Institute of Engineering and Technology" ,
"Indian Institute of Handloom Technology" ,
"Dhirajlal Gandhi College of Technology" ,
"Shree Sathyam College of Engineering and Technology" ,
"AVS College of Technology" ,
"Dhaanish Ahmed Institute of Technology" ,
"Jairupaa College of Engineering" ,
"Pollachi Institute of Engineering and Technology" ,
"Arulmurugan College of Engineering" ,
"V S B College of Engineering Technical Campus" ,
"Suguna College of Engineering" ,
"Arjun College of Technology" ,
"Vishnu Lakshmi College of Engineering and Technology" ,
"Government College of Engineering Dharmapuri" ,
"PSG Institute of Technology and Applied Research" ,
"Cherraan College of Technology" ,
"Adhiyamaan College of Engineering (Autonomous)" ,
"Annai Mathammal Sheela Engineering College" ,
"Government College of Engineering (Autonomous) Bargur Krishnagiri District" ,
"K S Rangasamy College of Technology (Autonomous)" ,
"M Kumarasamy College of Engineering (Autonomous)" ,
"Mahendra Engineering College (Autonomous)" ,
"Muthayammal Engineering College (Autonomous)" ,
"Paavai Engineering College (Autonomous)" ,
"P G P College of Engineering and Technology" ,
"K S R College of Engineering (Autonomous)" ,
"S S M College of Engineering" ,
"Government College of Engineering (Autonomous) Karuppur Salem District" ,
"Sapthagiri College of Engineering" ,
"Sengunthar Engineering College (Autonomous)" ,
"Sona College of Technology (Autonomous)" ,
"Vivekanandha College of Engineering for Women (Autonomous)" ,
"Er. Perumal Manimekalai College of Engineering (Autonomous)" ,
"V S B Engineering College (Autonomous)" ,
"Mahendra College of Engineering" ,
"Gnanamani College of Technology (Autonomous)" ,
"The Kavery Engineering College" ,
"Selvam College of Technology" ,
"Paavai College of Engineering" ,
"Chettinad College of Engineering and Technology" ,
"Mahendra Institute of Technology (Autonomous)" ,
"Vidyaa Vikas College of Engineering and Technology" ,
"Excel Engineering College (Autonomous)" ,
"CMS College of Engineering" ,
"A V S Engineering College" ,
"Mahendra Engineering College for Women" ,
"R P Sarathy Institute of Technology" ,
"Jayalakshmi Institute of Technology" ,
"Varuvan Vadivelan Institute of Technology" ,
"P S V College of Engineering and Technology" ,
"Bharathiyar Institute of Engineering for Women" ,
"Tagore Institute of Engineering and Technology" ,
"J K K Nataraja College of Engineering and Technology" ,
"Annapoorana Engineering College (Autonomous)" ,
"Christ The King Engineering College" ,
"Jai Shriram Engineering College" ,
"AL-Ameen Engineering College (Autonomous)" ,
"Knowledge Institute of Technology (Autonomous) KIOT Campus" ,
"Builders Engineering College" ,
"V S A Group of Institutions" ,
"Salem College of Engineering and Technology" ,
"Vivekanandha College of Technology for Women" ,
"Sree Sakthi Engineering College" ,
"Shreenivasa Engineering College" ,
"Bannari Amman Institute of Technology (Autonomous)" ,
"Coimbatore Institute of Engineering and Technology (Autonomous)" ,
"CSI College of Engineering" ,
"Dr. Mahalingam College of Engineering and Technology (Autonomous)" ,
"Erode Sengunthar Engineering College (Autonomous)" ,
"Hindusthan College of Engineering and Technology (Autonomous)" ,
"Government College of Engineering (Formerly IRTT)" ,
"Karpagam College of Engineering (Autonomous)" ,
"Kongu Engineering College (Autonomous)" ,
"Kumaraguru College of Technology (Autonomous)" ,
"M P Nachimuthu M Jaganathan Engineering College" ,
"Nandha Engineering College (Autonomous)" ,
"Park College of Engineering and Technology" ,
"Sasurie College of Engineering" ,
"Sri Krishna College of Engineering and Technology (Autonomous)" ,
"Sri Ramakrishna Engineering College (Autonomous)" ,
"Tamilnadu College of Engineering Karumathampatti" ,
"Sri Krishna College of Technology (Autonomous)" ,
"Velalar College of Engineering and Technology (Autonomous)" ,
"Sri Ramakrishna Institute of Technology (Autonomous)" ,
"SNS College of Technology (Autonomous)" ,
"Sri Shakthi Institute of Engineering and Technology (Autonomous)" ,
"Nehru Institute of Engineering and Technology" ,
"R V S College of Engineering and Technology" ,
"Info Institute of Engineering" ,
"Angel College of Engineering and Technology" ,
"SNS College of Engineering (Autonomous)" ,
"Karpagam Institute of Technology" ,
"Dr. N G P Institute of Technology (Autonomous)" ,
"Sri Sai Ranganathan Engineering College" ,
"Sri Eshwar College of Engineering (Autonomous)" ,
"Hindusthan Institute of Technology (Autonomous)" ,
"P A College of Engineering and Technology (Autonomous)" ,
"Dhanalakshmi Srinivasan College of Engineering (CBE)" ,
"Adithya Institute of Technology" ,
"Kathir College of Engineering" ,
"Shree Venkateshwara Hi-Tech Engineering College (Autonomous)" ,
"Surya Engineering College" ,
"Easa College of Engineering and Technology" ,
"KIT - Kalaignar Karunanidhi Institute of Technology (Autonomous)" ,
"KGISL Institute of Technology KGISL Campus" ,
"Nandha College of Technology" ,
"PPG Institute of Technology" ,
"Nehru Institute of Technology (Autonomous)" ,
"J K K Munirajah College of Technology" ,
"United Institute of Technology" ,
"Jansons Institute of Technology" ,
"Akshaya College of Engineering and Technology" ,
"K P R Institute of Engineering and Technology (Autonomous)" ,
"SRG Engineering College" ,
"Park College of Technology" ,
"J C T College of Engineering and Technology" ,
"Studyworld College of Engineering" ,
"C M S College of Engineering and Technology" ,
"R V S Technical Campus-Coimbatore" ,
"University College of Engineering Tiruchirappalli" ,
"University College of Engineering Ariyalur" ,
"University College of Engineering Nagappattinam" ,
"University College of Engineering Kumbakonam" ,
"University College of Engineering Thanjavur" ,
"Mahalakshmi Engineering College Trichy-Salem" ,
"Krishnasamy College of Engineering and Technology" ,
"C K College of Engineering and Technology" ,
"Sri Ramakrishna College of Engineering" ,
"K S K College of Engineering and Technology" ,
"Surya College of Engineering" ,
"Arifa Institute of Technology" ,
"Ariyalur Engineering College" ,
"Government College of Engineering Gandarvakotta" ,
"Government College of Engineering Srirangam" ,
"Nelliandavar Institute of Technology" ,
"K Ramakrishnan College of Technology (Autonomous)" ,
"Sir Issac Newton College of Engineering and Technology" ,
"Star Lion College of Engineering and Technology" ,
"OASYS Institute of Technology" ,
"M.A.M. School of Engineering" ,
"SRM TRP Engineering College" ,
"A V C College of Engineering" ,
"Shri Angalamman College of Engineering and Technology" ,
"Anjalai Ammal Mahalingam Engineering College" ,
"Arasu Engineering College" ,
"Dhanalakshmi Srinivasan Engineering College" ,
"E G S Pillay Engineering College (Autonomous)" ,
"J J College of Engineering and Technology" ,
"Jayaram College of Engineering and Technology" ,
"Kurinji College of Engineering and Technology" ,
"M.A.M. College of Engineering" ,
"M I E T Engineering College" ,
"Mookambigai College of Engineering" ,
"Oxford Engineering College" ,
"P R Engineering College" ,
"Pavendar Bharathidasan College of Engineering and Technology" ,
"Roever Engineering College" ,
"Saranathan College of Engineering" ,
"Trichy Engineering College" ,
"A R J College of Engineering and Technology" ,
"Dr.Navalar Nedunchezhiyan College of Engineering" ,
"St. Joseph's College of Engineering and Technology" ,
"Kongunadu College of Engineering and Technology (Autonomous)" ,
"M.A.M. College of Engineering and Technology" ,
"K Ramakrishnan College of Engineering (Autonomous)" ,
"Indra Ganesan College of Engineering" ,
"Parisutham Institute of Technology and Science" ,
"CARE College of Engineering" ,
"M R K Institute of Technology" ,
"Shivani Engineering College" ,
"Imayam College of Engineering" ,
"Mother Terasa College of Engineering and Technology" ,
"Vandayar Engineering College" ,
"Annai College of Engineering and Technology" ,
"Vetri Vinayaha College of Engineering and Technology" ,
"Sri Bharathi Engineering College for Women" ,
"Mahath Amma Institute of Engineering and Technology (MIET)" ,
"As-Salam College of Engineering and Technology" ,
"Meenakshi Ramaswamy Engineering College" ,
"Sembodai Rukmani Varatharajan Engineering College" ,
"St. Anne's College of Engineering and Technology" ,
"Kings College of Engineering" ,
"Mount Zion College of Engineering and Technology" ,
"Shanmuganathan Engineering College" ,
"Sudharsan Engineering College" ,
"M N S K College of Engineering" ,
"Chendhuran College of Engineering and Technology" ,
"Anna University Regional Campus - Tirunelveli" ,
"University College of Engineering Nagercoil" ,
"University V.O.C. College of Engineering" ,
"Thamirabharani Engineering College" ,
"Rohini College of Engineering & Technology" ,
"Stella Mary's College of Engineering" ,
"Universal College of Engineering and Technology" ,
"Renganayagi Varatharaj College of Engineering" ,
"Lourdes Mount College of Engineering and Technology" ,
"Ramco Institute of Technology" ,
"AAA College of Engineering and Technology" ,
"Good Shepherd College of Engineering and Technology" ,
"V V College of Engineering" ,
"Sethu Institute of Technology (Autonomous)" ,
"Sun College of Engineering and Technology" ,
"Maria College of Engineering and Technology" ,
"MAR Ephraem College of Engineering & Technology" ,
"M E T Engineering College" ,
"Grace College of Engineering" ,
"St. Mother Theresa Engineering College" ,
"Holy Cross Engineering College" ,
"A.R College of Engineering and Technology" ,
"Sivaji College of Engineering and Technology" ,
"Unnamalai Institute of Technology" ,
"Satyam College of Engineering and Technology" ,
"Arunachala College of Engineering for Women" ,
"D M I Engineering College" ,
"PSN Institute of Technology and Science" ,
"C S I Institute of Technology" ,
"CAPE Institute of Technology" ,
"Dr. Sivanthi Aditanar College of Engineering" ,
"Francis Xavier Engineering College (Autonomous)" ,
"Jayamatha Engineering College" ,
"Jayaraj Annapackiam CSI College of Engineering" ,
"Kamaraj College of Engineering and Technology (Autonomous)" ,
"Mepco Schlenk Engineering College (Autonomous)" ,
"Nellai College of Engineering" ,
"National Engineering College (Autonomous) Kovilpatti" ,
"PSN College of Engineering and Technology (Autonomous)" ,
"P S R Engineering College (Autonomous)" ,
"PET Engineering College" ,
"S Veerasamy Chettiar College of Engineering and Technology" ,
"Sardar Raja College of Engineering" ,
"SCAD College of Engineering and Technology" ,
"Sree Sowdambika College of Engineering" ,
"St. Xavier's Catholic College of Engineering" ,
"AMRITA College of Engineering and Technology" ,
"Government College of Engineering Tirunelveli" ,
"Dr. G U Pope College of Engineering" ,
"Infant Jesus College of Engineering" ,
"Narayanaguru College of Engineering" ,
"Udaya School of Engineering" ,
"Arul Tharum VPMM College of Engineering and Technology" ,
"Einstein College of Engineering" ,
"Ponjesly College of Engineering" ,
"Vins Christian College of Engineering" ,
"Lord Jegannath College of Engineering and Technology" ,
"Marthandam College of Engineering & Technology" ,
"Noorul Islam College of Engineering and Technology" ,
"PSN Engineering College" ,
"Bethlahem Institute of Engineering" ,
"Loyola Institute of Technology and Science" ,
"J P College of Engineering College" ,
"P.S.R.R College of Engineering" ,
"Sri Vidya College of Engineering and Technology" ,
"Mahakavi Bharathiyar College of Engineering and Technology" ,
"Annai Vailankanni College of Engineering" ,
"Thiagarajar College of Engineering" ,
"Government College of Engineering" ,
"Anna University Regional Campus" ,
"Central Electrochemical Research Institute" ,
"University College of Engineering Ramanathapuram" ,
"University College of Engineering Dindigul" ,
"Sri Raajaraajan College of Engineering & Technology" ,
"SSM Institute of Engineering and Technology" ,
"Vaigai College of Engineering" ,
"Karaikudi Institute of Technology" ,
"Mangayarkarasi College of Engineering" ,
"Jainee College of Engineering and Technology" ,
"Christian College of Engineering and Technology" ,
"N P R College of Engineering and Technology (Autonomous)" ,
"SRM Madurai College for Engineering and Technology" ,
"Veerammal Engineering College" ,
"R V S Educational Trust's Groups of Institutions" ,
"Nadar Saraswathi College of Engineering and Technology" ,
"Alagappa Chettiar Government College of Engineering and Technology (Autonomous)" ,
"Bharath Niketan Engineering College" ,
"K L N College of Engineering (Autonomous)" ,
"Mohamed Sathak Engineering College" ,
"P S N A College of Engineering and Technology (Autonomous)" ,
"P T R College of Engineering and Technology" ,
"Pandian Saraswathi Yadav Engineering College" ,
"R V S College of Engineering" ,
"Solamalai College of Engineering" ,
"SACS-M A V M M Engineering College" ,
"St. Michael College of Engineering and Technology" ,
"Syed Ammal Engineering College" ,
"Ganapathy Chettiar College of Engineering and Technology" ,
"SBM College of Engineering and Technology" ,
"Fatima Michael College of Engineering and Technology" ,
"Ultra College of Engineering and Technology" ,
"Velammal College of Engineering and Technology (Autonomous)" ,
"Theni Kammavar Sangam College of Technology" ,
"Latha Mathavan Engineering College" ,
"Other"]

# ================= ENHANCED SEARCHABLE DROPDOWN =================
def is_valid_email(email: str) -> bool:
    email = email.strip()
    if not email:
        return False
    return email.endswith("@gmail.com") and "@" in email and email.count("@") == 1


def is_valid_phone(phone: str) -> bool:
    phone = phone.strip()
    return phone.isdigit() and len(phone) == 10

class EnhancedSearchableDropdown(tk.Frame):
    """Enhanced dropdown with better search and visual feedback"""
    
    def __init__(self, parent, options, placeholder="Select or type to search...", height=8):
        super().__init__(parent, bg=COLORS["bg_card"])
        
        self.options = sorted(options)
        self.var = tk.StringVar()
        self.placeholder = placeholder
        self.is_placeholder = True
        self.listbox_visible = False
        self.listbox_height = height
        
        # Main entry container with border
        self.entry_container = tk.Frame(self, bg=COLORS["border"], highlightthickness=0)
        self.entry_container.pack(fill="x")
        
        # Inner container for padding
        self.inner_container = tk.Frame(self.entry_container, bg=COLORS["bg_input"])
        self.inner_container.pack(fill="both", expand=True, padx=1, pady=1)
        
        # Entry field
        self.entry = tk.Entry(
            self.inner_container,
            textvariable=self.var,
            font=("Segoe UI", 10),
            bg=COLORS["bg_input"],
            fg=COLORS["text_muted"],
            insertbackground=COLORS["text_primary"],
            relief="flat",
            borderwidth=0
        )
        self.entry.pack(side="left", fill="x", expand=True, ipady=8, padx=(12, 0))
        
        # Dropdown arrow with animation
        self.arrow = tk.Label(
            self.inner_container,
            text="▼",
            bg=COLORS["bg_input"],
            fg=COLORS["text_muted"],
            font=("Segoe UI", 8),
            cursor="hand2"
        )
        self.arrow.pack(side="right", padx=(0, 12))
        
        # Set placeholder
        self.var.set(placeholder)
        
        # Dropdown listbox container
        self.listbox_frame = tk.Frame(self, bg=COLORS["border"])
        
        # Scrollbar for listbox
        self.scrollbar = tk.Scrollbar(self.listbox_frame)
        
        # Listbox
        self.listbox = tk.Listbox(
            self.listbox_frame,
            height=self.listbox_height,
            font=("Segoe UI", 10),
            bg=COLORS["bg_input"],
            fg=COLORS["text_primary"],
            selectbackground=COLORS["accent"],
            selectforeground=COLORS["text_primary"],
            relief="flat",
            borderwidth=0,
            activestyle="none",
            yscrollcommand=self.scrollbar.set,
            exportselection=False
        )
        
        self.scrollbar.config(command=self.listbox.yview)
        self.scrollbar.pack(side="right", fill="y")
        self.listbox.pack(side="left", fill="both", expand=True, padx=1, pady=1)
        
        # Search status label
        self.status_label = tk.Label(
            self.listbox_frame,
            text="",
            font=("Segoe UI", 8),
            bg=COLORS["bg_secondary"],
            fg=COLORS["text_muted"],
            pady=4
        )
        
        # Bindings - only bind dropdown-specific navigation
        self.entry.bind("<FocusIn>", self._on_focus_in)
        self.entry.bind("<FocusOut>", self._on_focus_out)
        self.entry.bind("<KeyRelease>", self._on_key_release)
        
        # Only intercept Down/Up when listbox is visible
        self.entry.bind("<Down>", self._arrow_down)
        self.entry.bind("<Up>", self._arrow_up)
        self.entry.bind("<Return>", self._select_current)
        self.entry.bind("<Escape>", self._hide_listbox)
        
        # Enable Ctrl+A
        def select_all(e):
            if not self.is_placeholder:
                self.entry.select_range(0, tk.END)
                self.entry.icursor(tk.END)
            return "break"
        self.entry.bind("<Control-a>", select_all)
        
        self.arrow.bind("<Button-1>", self._toggle_listbox)
        self.arrow.bind("<Enter>", self._on_arrow_enter)
        self.arrow.bind("<Leave>", self._on_arrow_leave)
        
        self.listbox.bind("<<ListboxSelect>>", self._on_listbox_select)
        self.listbox.bind("<Return>", self._select_current)
        self.listbox.bind("<Escape>", self._hide_listbox)
        self.listbox.bind("<Double-Button-1>", self._on_double_click)
        
        # Hover effects for entry
        self.entry.bind("<Enter>", self._on_entry_enter)
        self.entry.bind("<Leave>", self._on_entry_leave)
    
    def _on_entry_enter(self, event=None):
        if not self.listbox_visible:
            self.inner_container.configure(bg=COLORS["bg_input_hover"])
            self.entry.configure(bg=COLORS["bg_input_hover"])
            self.arrow.configure(bg=COLORS["bg_input_hover"])
    
    def _on_entry_leave(self, event=None):
        if not self.listbox_visible:
            self.inner_container.configure(bg=COLORS["bg_input"])
            self.entry.configure(bg=COLORS["bg_input"])
            self.arrow.configure(bg=COLORS["bg_input"])
    
    def _on_arrow_enter(self, event=None):
        self.arrow.configure(fg=COLORS["accent"])
        if not self.listbox_visible:
            self.inner_container.configure(bg=COLORS["bg_input_hover"])
            self.entry.configure(bg=COLORS["bg_input_hover"])
            self.arrow.configure(bg=COLORS["bg_input_hover"])
    
    def _on_arrow_leave(self, event=None):
        self.arrow.configure(fg=COLORS["text_muted"])
        if not self.listbox_visible:
            self.inner_container.configure(bg=COLORS["bg_input"])
            self.entry.configure(bg=COLORS["bg_input"])
            self.arrow.configure(bg=COLORS["bg_input"])
    
    def _toggle_listbox(self, event=None):
        if self.listbox_visible:
            self._hide_listbox()
        else:
            self.entry.focus_set()
            if self.is_placeholder:
                self.var.set("")
                self.entry.configure(fg=COLORS["text_primary"])
                self.is_placeholder = False
            self._show_listbox()
            self._update_arrow()
    
    def _show_listbox(self):
        if not self.listbox_visible:
            self._filter_options()
            self.listbox_frame.pack(fill="both", expand=True, pady=(2, 0))
            self.listbox_visible = True
            self._update_arrow()
    
    def _hide_listbox(self, event=None):
        if self.listbox_visible:
            self.listbox_frame.pack_forget()
            self.listbox_visible = False
            self._update_arrow()
            if not self.var.get().strip():
                self.var.set(self.placeholder)
                self.entry.configure(fg=COLORS["text_muted"])
                self.is_placeholder = True
    
    def _update_arrow(self):
        if self.listbox_visible:
            self.arrow.configure(text="▲", fg=COLORS["accent"])
        else:
            self.arrow.configure(text="▼", fg=COLORS["text_muted"])
    
    def _on_focus_in(self, event=None):
        if self.is_placeholder:
            self.var.set("")
            self.entry.configure(fg=COLORS["text_primary"])
            self.is_placeholder = False
        self._show_listbox()
    
    def _on_focus_out(self, event=None):
        # Delay to allow listbox selection
        self.after(200, self._check_and_hide)
    
    def _check_and_hide(self):
        # Only hide if focus is not in listbox
        focused = self.focus_get()
        if focused != self.listbox and focused != self.entry:
            self._hide_listbox()
    
    def _on_key_release(self, event=None):
        # Ignore navigation keys
        if event and event.keysym in ('Down', 'Up', 'Return', 'Escape', 'Left', 'Right', 'Home', 'End'):
            return
        
        if not self.is_placeholder:
            self._filter_options()
            if not self.listbox_visible:
                self._show_listbox()
    
    def _filter_options(self):
        search_term = self.var.get().lower().strip()
        self.listbox.delete(0, tk.END)
        
        if self.is_placeholder or not search_term:
            # Show all options
            matches = self.options
        else:
            # Filter options by search term
            matches = [opt for opt in self.options if search_term in opt.lower()]
        
        if not matches:
            self.listbox.insert(tk.END, "No matches found")
            self.listbox.itemconfig(0, fg=COLORS["text_muted"])
            self._update_status(f"No results for '{search_term}'")
        else:
            for match in matches:
                self.listbox.insert(tk.END, match)
            
            # Highlight exact matches
            for i, match in enumerate(matches):
                if search_term and search_term in match.lower():
                    self.listbox.itemconfig(i, fg=COLORS["text_primary"])
            
            # Auto-select first item
            if matches:
                self.listbox.selection_clear(0, tk.END)
                self.listbox.selection_set(0)
                self.listbox.activate(0)
                self.listbox.see(0)
            
            self._update_status(f"{len(matches)} result{'s' if len(matches) != 1 else ''}")
    
    def _update_status(self, text):
        if text:
            self.status_label.configure(text=f"  {text}")
            if not self.status_label.winfo_ismapped():
                self.status_label.pack(side="bottom", fill="x")
        else:
            self.status_label.pack_forget()
    
    def _arrow_down(self, event=None):
        if not self.listbox_visible:
            self._show_listbox()
            return "break"
        
        current = self.listbox.curselection()
        if current:
            next_idx = current[0] + 1
            if next_idx < self.listbox.size():
                self.listbox.selection_clear(0, tk.END)
                self.listbox.selection_set(next_idx)
                self.listbox.activate(next_idx)
                self.listbox.see(next_idx)
        else:
            self.listbox.selection_set(0)
            self.listbox.activate(0)
        return "break"
    
    def _arrow_up(self, event=None):
        if not self.listbox_visible:
            return "break"
        
        current = self.listbox.curselection()
        if current:
            prev_idx = current[0] - 1
            if prev_idx >= 0:
                self.listbox.selection_clear(0, tk.END)
                self.listbox.selection_set(prev_idx)
                self.listbox.activate(prev_idx)
                self.listbox.see(prev_idx)
        return "break"
    
    def _select_current(self, event=None):
        if not self.listbox.curselection():
            return
        
        selected_value = self.listbox.get(self.listbox.curselection())
        
        if selected_value and selected_value != "No matches found":
            self.var.set(selected_value)
            self.entry.configure(fg=COLORS["text_primary"])
            self.is_placeholder = False
            self._hide_listbox()
            self.entry.icursor(tk.END)
    
    def _on_listbox_select(self, event=None):
        # Just highlight, don't auto-fill
        pass
    
    def _on_double_click(self, event=None):
        self._select_current()
    
    def get(self):
        """Get the current value"""
        if self.is_placeholder:
            return ""
        return self.var.get().strip()
    
    def set(self, value):
        """Set the value"""
        self.var.set(value)
        self.entry.configure(fg=COLORS["text_primary"])
        self.is_placeholder = False
    
    def clear(self):
        """Clear the field"""
        self.var.set(self.placeholder)
        self.entry.configure(fg=COLORS["text_muted"])
        self.is_placeholder = True

# ================= MODERN BUTTON =================

class ModernButton(tk.Canvas):
    def __init__(self, parent, text, command=None, style="primary", width=200, height=44):
        super().__init__(parent, width=width, height=height, 
                        bg=COLORS["bg_card"], highlightthickness=0)
        
        self.command = command
        self.text = text
        self.style = style
        self.width = width
        self.height = height
        
        if style == "primary":
            self.bg_color = COLORS["bg_button"]
            self.hover_color = COLORS["bg_button_hover"]
            self.text_color = COLORS["text_primary"]
        else:  # secondary
            self.bg_color = COLORS["bg_secondary"]
            self.hover_color = COLORS["border"]
            self.text_color = COLORS["text_secondary"]
        
        self.current_color = self.bg_color
        self._draw()
        
        self.bind("<Button-1>", self._on_click)
        self.bind("<Enter>", self._on_enter)
        self.bind("<Leave>", self._on_leave)
    
    def _draw(self):
        self.delete("all")
        # Rounded rectangle
        radius = 6
        self.create_arc(0, 0, radius*2, radius*2, start=90, extent=90, 
                       fill=self.current_color, outline="")
        self.create_arc(self.width-radius*2, 0, self.width, radius*2, 
                       start=0, extent=90, fill=self.current_color, outline="")
        self.create_arc(0, self.height-radius*2, radius*2, self.height, 
                       start=180, extent=90, fill=self.current_color, outline="")
        self.create_arc(self.width-radius*2, self.height-radius*2, 
                       self.width, self.height, start=270, extent=90, 
                       fill=self.current_color, outline="")
        self.create_rectangle(radius, 0, self.width-radius, self.height, 
                            fill=self.current_color, outline="")
        self.create_rectangle(0, radius, self.width, self.height-radius, 
                            fill=self.current_color, outline="")
        
        # Text
        self.create_text(self.width/2, self.height/2, text=self.text, 
                        fill=self.text_color, font=("Segoe UI", 10, "bold"))
    
    def _on_enter(self, event):
        self.current_color = self.hover_color
        self._draw()
    
    def _on_leave(self, event):
        self.current_color = self.bg_color
        self._draw()
    
    def _on_click(self, event):
        if self.command:
            self.command()

# ================= UI APP =================

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(APP_TITLE)
        self.geometry(WINDOW_SIZE)
        self.resizable(False, False)
        self.configure(bg=COLORS["bg_dark"])
        
        # Configure ttk style for treeview
        style = ttk.Style(self)
        style.theme_use("clam")
        
        style.configure("Treeview",
                       background=COLORS["bg_input"],
                       foreground=COLORS["text_primary"],
                       fieldbackground=COLORS["bg_input"],
                       borderwidth=0)
        style.configure("Treeview.Heading",
                       background=COLORS["bg_secondary"],
                       foreground=COLORS["text_primary"],
                       borderwidth=1)
        style.map("Treeview",
                 background=[("selected", COLORS["accent"])])
        
        self.container = tk.Frame(self, bg=COLORS["bg_dark"])
        self.container.pack(fill="both", expand=True)
        
        self.qr_img = None
        self.show_login()
    
    # ---------- UTIL ----------
    
    def clear(self):
        for w in self.container.winfo_children():
            w.destroy()
    
    def card(self):
        frame = tk.Frame(self.container, bg=COLORS["bg_card"])
        frame.pack(padx=30, pady=30, fill="both", expand=True)
        return frame
    
    def input_field(self, parent, label, hide=False):
        frame = tk.Frame(parent, bg=COLORS["bg_card"])
        frame.pack(fill="x", pady=8)
        
        tk.Label(frame, text=label, 
                fg=COLORS["text_secondary"], 
                bg=COLORS["bg_card"],
                font=("Segoe UI", 9)).pack(anchor="w", pady=(0, 5))
        
        # Border container
        border_frame = tk.Frame(frame, bg=COLORS["border"])
        border_frame.pack(fill="x")
        
        # Inner container
        inner_frame = tk.Frame(border_frame, bg=COLORS["bg_input"])
        inner_frame.pack(fill="x", padx=1, pady=1)
        
        entry = tk.Entry(
            inner_frame,
            font=("Segoe UI", 10),
            bg=COLORS["bg_input"],
            fg=COLORS["text_primary"],
            insertbackground=COLORS["text_primary"],
            relief="flat",
            borderwidth=0,
            show="•" if hide else ""
        )
        entry.pack(fill="x", ipady=8, padx=12)
        
        # Hover effect
        def on_enter(e):
            inner_frame.configure(bg=COLORS["bg_input_hover"])
            entry.configure(bg=COLORS["bg_input_hover"])
        
        def on_leave(e):
            inner_frame.configure(bg=COLORS["bg_input"])
            entry.configure(bg=COLORS["bg_input"])
        
        entry.bind("<Enter>", on_enter)
        entry.bind("<Leave>", on_leave)
        
        # Enable Ctrl+A to select all
        def select_all(e):
            entry.select_range(0, tk.END)
            entry.icursor(tk.END)
            return "break"
        
        entry.bind("<Control-a>", select_all)
        
        return entry
    
    # ---------- HEADER ----------
    
    def header_bar(self, parent):
        bar = tk.Frame(parent, bg=COLORS["bg_card"])
        bar.pack(fill="x", pady=(0, 20))
        
        button_frame = tk.Frame(bar, bg=COLORS["bg_card"])
        button_frame.pack()
        
        btn1 = ModernButton(button_frame, "📊 Excel Export", 
                           command=self.export_csv, style="secondary", 
                           width=140, height=36)
        btn1.pack(side="left", padx=5)
        
        btn2 = ModernButton(button_frame, "🔍 Search", 
                           command=self.search_popup, style="secondary",
                           width=120, height=36)
        btn2.pack(side="left", padx=5)
        
        btn3 = ModernButton(button_frame, "📋 Database", 
                           command=self.db_view_popup, style="secondary",
                           width=130, height=36)
        btn3.pack(side="left", padx=5)
    
    # ---------- LOGIN ----------
    
    def show_login(self):
        self.clear()
        
        if os.path.exists(LOGIN_FLAG):
            if open(LOGIN_FLAG).read().strip() == "true":
                self.show_home()
                return
        
        card = self.card()
        
        # Logo/Title
        tk.Label(card, text="🔐", 
                fg=COLORS["accent_gold"],
                bg=COLORS["bg_card"],
                font=("Segoe UI", 48)).pack(pady=(40, 10))
        
        tk.Label(card, text="Desk Login", 
                fg=COLORS["accent_gold"],
                bg=COLORS["bg_card"], 
                font=("Segoe UI", 24, "bold")).pack(pady=(0, 40))
        
        self.login_email = self.input_field(card, "Email Address")
        self.login_pass = self.input_field(card, "Password", hide=True)
        
        btn_container = tk.Frame(card, bg=COLORS["bg_card"])
        btn_container.pack(pady=40)
        
        login_btn = ModernButton(btn_container, "Login", 
                                command=self.login, width=250)
        login_btn.pack()
    
    def login(self):
        if (self.login_email.get() == LOGIN_EMAIL and
            self.login_pass.get() == LOGIN_PASSWORD):
            open(LOGIN_FLAG, "w").write("true")
            self.show_home()
        else:
            messagebox.showerror("Access Denied", "Invalid credentials")
    
    # ---------- HOME ----------
    
    def show_home(self):
        self.clear()
        card = self.card()
        
        self.header_bar(card)
        
        # Title
        tk.Label(card, text="On-Spot Registration",
                fg=COLORS["accent"],
                bg=COLORS["bg_card"],
                font=("Segoe UI", 22, "bold")).pack(pady=(0, 25))
        
        # Form fields
        self.name = self.input_field(card, "Full Name")
        self.email = self.input_field(card, "Email Address")
        self.phone = self.input_field(card, "Phone Number")
        
        # College Dropdown
        tk.Label(card, text="College", 
                fg=COLORS["text_secondary"], 
                bg=COLORS["bg_card"],
                font=("Segoe UI", 9)).pack(anchor="w", pady=(8, 5))
        
        self.college = EnhancedSearchableDropdown(
            card, 
            COLLEGE_OPTIONS,
            placeholder="Select college or type to search...",
            height=5
        )
        self.college.pack(fill="x", pady=(0, 8))
        
        # Department Dropdown
        tk.Label(card, text="Department", 
                fg=COLORS["text_secondary"], 
                bg=COLORS["bg_card"],
                font=("Segoe UI", 9)).pack(anchor="w", pady=(8, 5))
        
        self.dept = EnhancedSearchableDropdown(
            card, 
            DEPARTMENT_OPTIONS,
            placeholder="Select department or type to search...",
            height=8
        )
        self.dept.pack(fill="x", pady=(0, 8))
        
        # Degree Dropdown
        tk.Label(card, text="Degree Program", 
                fg=COLORS["text_secondary"], 
                bg=COLORS["bg_card"],
                font=("Segoe UI", 9)).pack(anchor="w", pady=(8, 5))
        
        self.degree = EnhancedSearchableDropdown(
            card, 
            DEGREE_OPTIONS,
            placeholder="Select degree or type to search...",
            height=6
        )
        self.degree.pack(fill="x", pady=(0, 8))
        
        # Submit button
        btn_container = tk.Frame(card, bg=COLORS["bg_card"])
        btn_container.pack(pady=30)
        
        register_btn = ModernButton(btn_container, "Register & Generate QR", 
                                    command=self.register, width=280)
        register_btn.pack()
    
    # ---------- REGISTER ----------
    
    def register(self):
        payload = {
            "uid": f"ONSPOT-{int(time.time() * 1000)}",
            "name": self.name.get().strip(),
            "email": self.email.get().strip(),
            "phone": self.phone.get().strip(),
            "college": self.college.get(),
            "dept": self.dept.get(),
            "year": self.degree.get()
        }

        # Basic empty check
        if not all(payload.values()):
            messagebox.showwarning("Missing Data", "Please fill all fields")
            return

        # ---- EMAIL CHECK ----
        if not is_valid_email(payload["email"]):
            messagebox.showerror(
                "Invalid Email",
                "Email must be a valid Gmail address ending with @gmail.com"
            )
            return

        # ---- PHONE CHECK ----
        if not is_valid_phone(payload["phone"]):
            messagebox.showerror(
                "Invalid Phone Number",
                "Phone number must be exactly 10 digits"
            )
            return

        existing = participant_exists(payload["email"], payload["phone"])

        if existing:
            if not messagebox.askyesno(
                "User Already Exists",
                "This user is already registered.\n\nGenerate QR code anyway?"
            ):
                return
            self.show_qr(payload)
            return

        try:
            insert_participant(payload)
            append_backup(payload)
            self.show_qr(payload)
        except Exception as e:
            messagebox.showerror(
                "Database Error",
                f"Failed to save participant:\n{str(e)}"
            )

        # ---------- QR VIEW ----------
        
    def show_qr(self, payload):
        self.clear()
        card = self.card()
        
        # Success icon
        tk.Label(card, text="✓", 
                fg=COLORS["accent"],
                bg=COLORS["bg_card"],
                font=("Segoe UI", 60, "bold")).pack(pady=(30, 10))
        
        tk.Label(card, text="Registration Successful",
                fg=COLORS["accent"],
                bg=COLORS["bg_card"],
                font=("Segoe UI", 20, "bold")).pack(pady=(0, 30))
        
        # QR Code
        qr = qrcode.make(json.dumps(payload))
        qr = qr.resize((280, 280))
        self.qr_img = ImageTk.PhotoImage(qr)
        
        qr_frame = tk.Frame(card, bg=COLORS["bg_dark"], padx=15, pady=15)
        qr_frame.pack(pady=15)
        
        tk.Label(qr_frame, image=self.qr_img, bg=COLORS["bg_dark"]).pack()
        
        # UID
        tk.Label(card, text=f"UID: {payload['uid']}",
                fg=COLORS["text_secondary"],
                bg=COLORS["bg_card"],
                font=("Consolas", 10)).pack(pady=10)
        
        # Done button
        btn_container = tk.Frame(card, bg=COLORS["bg_card"])
        btn_container.pack(pady=30)
        
        done_btn = ModernButton(btn_container, "Done - Next Registration", 
                            command=self.show_home, width=280)
        done_btn.pack()
    
    # ---------- EXPORT ----------
    
    def export_csv(self):
        rows = fetch_all()
        if not rows:
            messagebox.showinfo("No Data", "Nothing to export")
            return
        
        path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv")]
        )
        if not path:
            return
        
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "UID", "Name", "Email", "Phone",
                "College", "Dept", "Year", "Created At"
            ])
            writer.writerows(rows)
        
        messagebox.showinfo("Export Complete", "CSV exported successfully")
    
    # ---------- SEARCH ----------
    
    def search_popup(self):
        win = tk.Toplevel(self)
        win.title("Search Participants")
        win.geometry("600x400")
        win.configure(bg=COLORS["bg_dark"])
        
        container = tk.Frame(win, bg=COLORS["bg_card"])
        container.pack(fill="both", expand=True, padx=20, pady=20)
        
        tk.Label(container, text="Search Participants",
                fg=COLORS["text_primary"],
                bg=COLORS["bg_card"],
                font=("Segoe UI", 16, "bold")).pack(pady=(10, 20))
        
        # Search input
        search_frame = tk.Frame(container, bg=COLORS["bg_card"])
        search_frame.pack(fill="x", pady=10)
        
        border_frame = tk.Frame(search_frame, bg=COLORS["border"])
        border_frame.pack(fill="x")
        
        inner_frame = tk.Frame(border_frame, bg=COLORS["bg_input"])
        inner_frame.pack(fill="x", padx=1, pady=1)
        
        entry = tk.Entry(
            inner_frame,
            font=("Segoe UI", 10),
            bg=COLORS["bg_input"],
            fg=COLORS["text_primary"],
            insertbackground=COLORS["text_primary"],
            relief="flat",
            borderwidth=0
        )
        entry.pack(fill="x", ipady=8, padx=12)
        
        # Enable Ctrl+A
        def select_all(e):
            entry.select_range(0, tk.END)
            entry.icursor(tk.END)
            return "break"
        entry.bind("<Control-a>", select_all)
        
        # Results listbox
        scrollbar = tk.Scrollbar(container)
        scrollbar.pack(side="right", fill="y")
        
        box = tk.Listbox(
            container,
            font=("Segoe UI", 9),
            bg=COLORS["bg_input"],
            fg=COLORS["text_primary"],
            selectbackground=COLORS["accent"],
            relief="flat",
            yscrollcommand=scrollbar.set
        )
        box.pack(fill="both", expand=True, pady=10)
        scrollbar.config(command=box.yview)
        
        def run():
            q = entry.get().lower()
            box.delete(0, tk.END)
            count = 0
            for r in fetch_all():
                if q in " ".join(map(str, r)).lower():
                    box.insert(tk.END, f"{r[1]} | {r[2]} | {r[3]} | {r[0]}")
                    count += 1
            if count == 0:
                box.insert(tk.END, "No results found")
        
        btn_frame = tk.Frame(container, bg=COLORS["bg_card"])
        btn_frame.pack(pady=10)
        
        search_btn = ModernButton(btn_frame, "Search", command=run, width=150)
        search_btn.pack()
        
        entry.bind("<Return>", lambda e: run())
        entry.bind("<KeyRelease>", lambda e: run())
    
    # ---------- DB VIEW ----------
    
    def db_view_popup(self):
        win = tk.Toplevel(self)
        win.title("Database View")
        win.geometry("900x500")
        win.configure(bg=COLORS["bg_dark"])
        
        container = tk.Frame(win, bg=COLORS["bg_card"])
        container.pack(fill="both", expand=True, padx=20, pady=20)
        
        tk.Label(container, text="All Participants",
                fg=COLORS["text_primary"],
                bg=COLORS["bg_card"],
                font=("Segoe UI", 16, "bold")).pack(pady=(10, 20))
        
        cols = ("UID", "Name", "Email", "Phone", "College", "Dept", "Year", "Created")
        tree = ttk.Treeview(container, columns=cols, show="headings")
        
        for c in cols:
            tree.heading(c, text=c)
            tree.column(c, width=110)
        
        scrollbar = ttk.Scrollbar(container, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=scrollbar.set)
        
        tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        for r in fetch_all():
            tree.insert("", tk.END, values=r)

# ================= MAIN =================

if __name__ == "__main__":
    init_db()
    App().mainloop()