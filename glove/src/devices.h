
typedef struct _DD {
        const int esp_chip_id;
        const int id;
} device_details ;

// current
const device_details devices[] = {
  //{, 201},
  {0x0029DEAD, 202},
  {0x0029DCAB, 203},
  {0x00D2F1AE, 204},
  {0x0000AEDD, 205},
  {0x0029DEF8, 206},
  {0x0000A7EB, 207},
  {0x00010D63, 208},
  {0x00010DC0, 209},
  //{, 210},
  {0x0023AB2B, 211}, // missing sensors
  {0x000AF015, 212},
  {0x008E8661, 213},
  {0x008E870F, 214},
  {0x008E9335, 215},
  {0x008E88B7, 216},
  {0x008E92EB, 217},
  {0x008E92BA, 218},
  {0x008E873B, 219},
  {0x008E89C9, 220},
  {0x008E91CA, 221},
  {0x008E8E60, 222},
  {0x008E8532, 223},
  {0x008E91E5, 224},
  {0x008E8624, 225},
  {0x008E911C, 226},
  {0x008E9399, 227},
  {0x008E9368, 228},
  {0x008E87EC, 229},
  {0x008E90FB, 230},
  {0x008E85C8, 231},
  {0x008E9301, 232},
  {0x008E86FD, 233},
  {0x008E9374, 234},
  {0x008E8844, 235},
  {0x008E85D6, 236},
  {0x00499C81, 237},
  {0x008E9012, 238},
  {0x008E91A2, 239},
  {0x008E936C, 240},
  {0, 200} // default if define not defined above
};

