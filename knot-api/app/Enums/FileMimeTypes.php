<?php

namespace App\Enums;

enum FileMimeTypes: string
{
    case JPEG = 'jpeg';
    case JPG = 'jpg';
    case PNG = 'png';
    case GIF = 'gif';
    case PDF = 'pdf';
    case DOC = 'doc';
    case DOCX = 'docx';
    case XLS = 'xls';
    case XLSX = 'xlsx';
    case MP4 = 'mp4';
    case AVI = 'avi';
    case MOV = 'mov';

    /**
     * Get all MIME types as comma-separated string for validation
     */
    public static function getValidationString(): string
    {
        return implode(',', array_column(self::cases(), 'value'));
    }
}
